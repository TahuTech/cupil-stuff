// Logika servis di server (pocketbase/pb_hooks/servis.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const S = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/servis.js");

const isian = (lain: Record<string, unknown> = {}) => ({
  nama: "Budi",
  wa: "0812-3456-7890",
  perangkat_jenis: "mouse",
  perangkat: "Logitech G102",
  keluhan: "Double click dan scroll lompat",
  cara_kirim: "kurir",
  provinsi: "Jawa Barat",
  ...lain,
});

const ZONA = [
  { provinsi: ["Kota Surabaya"], tarif_per_kg: 8_000 },
  { provinsi: ["Jawa Barat", "Jawa Timur"], tarif_per_kg: 20_000 },
  { provinsi: ["Papua"], tarif_per_kg: 100_000 },
];

describe("normalisasiWA (servis)", () => {
  it.each([
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["81234567890", "6281234567890"],
  ])("%s → %s", (masuk, hasil) => expect(S.normalisasiWA(masuk)).toBe(hasil));
  it.each(["12345", "0212345678", "", null, "08123"])("%s → null", (masuk) => expect(S.normalisasiWA(masuk)).toBeNull());
});

describe("validasiInput (servis)", () => {
  it("menolak isian kosong dengan pesan per field", () => {
    const v = S.validasiInput({});
    expect(v.ok).toBe(false);
    expect(Object.keys(v.galat).sort()).toEqual(["cara_kirim", "keluhan", "nama", "perangkat", "perangkat_jenis", "wa"]);
  });

  it("isian lengkap diterima, WA dinormalisasi ke 62…, nama dirapikan", () => {
    const v = S.validasiInput(isian({ nama: "  Budi   Santoso ", wa: "+62 812 3456 7890" }));
    expect(v.ok).toBe(true);
    expect(v.data).toMatchObject({ nama: "Budi Santoso", wa: "6281234567890", cara_kirim: "kurir", provinsi: "Jawa Barat", perangkat_jenis: "mouse", jasa: null });
  });

  it("provinsi wajib jika kurir, diabaikan jika antar langsung", () => {
    expect(S.validasiInput(isian({ provinsi: "" })).galat.provinsi).toBeTruthy();
    expect(S.validasiInput(isian({ provinsi: "a".repeat(61) })).galat.provinsi).toBeTruthy();
    const antar = S.validasiInput(isian({ cara_kirim: "antar", provinsi: "" }));
    expect(antar.ok).toBe(true);
    expect(antar.data.provinsi).toBe("");
  });

  it("cara_kirim dan jenis perangkat hanya dari daftar", () => {
    expect(S.validasiInput(isian({ cara_kirim: "ojol" })).galat.cara_kirim).toBeTruthy();
    expect(S.validasiInput(isian({ perangkat_jenis: "laptop" })).galat.perangkat_jenis).toBeTruthy();
  });

  it("panjang input dibatasi", () => {
    expect(S.validasiInput(isian({ nama: "a".repeat(81) })).galat.nama).toBeTruthy();
    expect(S.validasiInput(isian({ perangkat: "a".repeat(81) })).galat.perangkat).toBeTruthy();
    expect(S.validasiInput(isian({ keluhan: "rusak" })).galat.keluhan).toBeTruthy();
    expect(S.validasiInput(isian({ keluhan: "a".repeat(1001) })).galat.keluhan).toBeTruthy();
  });

  it("jasa opsional; id jasa divalidasi formatnya", () => {
    expect(S.validasiInput(isian({ jasa: "" })).data.jasa).toBeNull();
    expect(S.validasiInput(isian({ jasa: "bukan-id" })).galat.jasa).toBeTruthy();
    expect(S.validasiInput(isian({ jasa: "aaaaaaaaaaaaaa1" })).data.jasa).toBe("aaaaaaaaaaaaaa1");
  });
});

describe("validasiFoto", () => {
  const kb = (n: number) => ({ size: n * 1024 });
  it("0–5 foto kecil diterima", () => {
    expect(S.validasiFoto([])).toBe("");
    expect(S.validasiFoto([kb(300), kb(400), kb(500), kb(100), kb(200)])).toBe("");
  });
  it("lebih dari 5 foto, foto > 5 MB, atau foto kosong ditolak", () => {
    expect(S.validasiFoto(Array.from({ length: 6 }, () => kb(100)))).toMatch(/Maksimal 5/);
    expect(S.validasiFoto([kb(5 * 1024 + 1)])).toMatch(/5 MB/);
    expect(S.validasiFoto([{ size: 0 }])).toBeTruthy();
  });
});

describe("buatNomor tiket", () => {
  it("format SRV-YYMMDD-XXXX dengan tanggal WIB", () => {
    // 2026-11-20 18:30 UTC = 2026-11-21 01:30 WIB
    expect(S.buatNomor(Date.UTC(2026, 10, 20, 18, 30), () => 0)).toBe("SRV-261121-AAAA");
    expect(S.buatNomor(Date.UTC(2026, 0, 5, 3, 0), () => 0.999)).toMatch(/^SRV-260105-9{4}$/);
  });
  it("hanya huruf yang tidak mudah tertukar", () => {
    for (let i = 0; i < 200; i++) expect(S.buatNomor(Date.now(), Math.random)).toMatch(/^SRV-\d{6}-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe("ongkirKirimBalik (zona sama, berat bawaan per jenis perangkat, tanpa potongan)", () => {
  it("antar langsung → 0", () => expect(S.ongkirKirimBalik("antar", "", "keyboard", ZONA)).toBe(0));
  it("mouse 300 g ke Jawa Barat → 1 kg × 20.000", () => expect(S.ongkirKirimBalik("kurir", "Jawa Barat", "mouse", ZONA)).toBe(20_000));
  it("keyboard 900 g ke Papua → 1 kg × 100.000", () => expect(S.ongkirKirimBalik("kurir", "Papua", "keyboard", ZONA)).toBe(100_000));
  it("Kota Surabaya → 8.000", () => expect(S.ongkirKirimBalik("kurir", "Kota Surabaya", "lainnya", ZONA)).toBe(8_000));
  it("provinsi tanpa zona → null (diisi manual)", () => expect(S.ongkirKirimBalik("kurir", "Atlantis", "mouse", ZONA)).toBeNull());
  it("berat bawaan sesuai config", () => expect(S.BERAT_PERANGKAT).toEqual({ mouse: 300, keyboard: 900, lainnya: 500 }));
});

describe("hitungTagihan: selesai/dikembalikan × kurir/antar", () => {
  const t = (status: string, cara_kirim: string, lain: Record<string, number> = {}) =>
    S.hitungTagihan({ status, cara_kirim, estimasi_biaya: 75_000, biaya_final: 80_000, ongkir_kirim_balik: 20_000, ...lain });

  it("selesai + kurir → biaya_final + ongkir kirim balik", () => {
    expect(t("selesai", "kurir")).toEqual({ jenis: "servis", biaya: 80_000, ongkir_kirim_balik: 20_000, total: 100_000, perlu_bayar: true, lunas: false });
  });
  it("selesai + antar → biaya_final saja (ongkir 0)", () => {
    expect(t("selesai", "antar")).toEqual({ jenis: "servis", biaya: 80_000, ongkir_kirim_balik: 0, total: 80_000, perlu_bayar: true, lunas: false });
  });
  it("dikembalikan + kurir → HANYA ongkir kirim balik", () => {
    expect(t("dikembalikan", "kurir")).toEqual({ jenis: "kirim_balik", biaya: 0, ongkir_kirim_balik: 20_000, total: 20_000, perlu_bayar: true, lunas: false });
  });
  it("dikembalikan + antar → tidak ada tagihan sama sekali", () => {
    expect(t("dikembalikan", "antar")).toEqual({ jenis: "tidak_ada", biaya: 0, ongkir_kirim_balik: 0, total: 0, perlu_bayar: false, lunas: false });
  });
  it("selesai tanpa biaya_final memakai estimasi", () => {
    expect(t("selesai", "antar", { biaya_final: 0 }).total).toBe(75_000);
  });
  it("bagian yang belum diketahui → total null (dikabari via WhatsApp)", () => {
    expect(t("selesai", "kurir", { ongkir_kirim_balik: 0 })).toMatchObject({ ongkir_kirim_balik: null, total: null });
    expect(t("selesai", "antar", { biaya_final: 0, estimasi_biaya: 0 })).toMatchObject({ biaya: null, total: null });
    expect(t("dikembalikan", "kurir", { ongkir_kirim_balik: 0 })).toMatchObject({ total: null });
  });
  it("status lain belum punya tagihan", () => {
    for (const s of ["menunggu_perangkat", "diterima", "dicek", "menunggu_persetujuan", "dikerjakan"]) expect(t(s, "kurir")).toBeNull();
  });
  it("tagihan tetap tercatat setelah perangkat dikirim balik", () => {
    expect(t("dikirim", "kurir")).toMatchObject({ jenis: "servis", total: 100_000 });
  });
  it("status_bayar lunas → lunas, tidak perlu bayar lagi", () => {
    const lunas = S.hitungTagihan({ status: "selesai", status_bayar: "lunas", cara_kirim: "kurir", estimasi_biaya: 0, biaya_final: 80_000, ongkir_kirim_balik: 20_000 });
    expect(lunas).toMatchObject({ total: 100_000, lunas: true, perlu_bayar: false });
    const kb = S.hitungTagihan({ status: "dikembalikan", status_bayar: "lunas", cara_kirim: "kurir", ongkir_kirim_balik: 20_000 });
    expect(kb).toMatchObject({ total: 20_000, lunas: true, perlu_bayar: false });
  });
});

describe("totalTagihan (field total_tagihan di panel admin)", () => {
  const dasar = { cara_kirim: "kurir", estimasi_biaya: 75_000, biaya_final: 0, ongkir_kirim_balik: 20_000 };
  it("mengikuti estimasi lalu biaya_final; dikembalikan hanya ongkir", () => {
    expect(S.totalTagihan({ ...dasar, status: "dicek" })).toBe(95_000);
    expect(S.totalTagihan({ ...dasar, status: "selesai", biaya_final: 90_000 })).toBe(110_000);
    expect(S.totalTagihan({ ...dasar, status: "dikembalikan" })).toBe(20_000);
    expect(S.totalTagihan({ ...dasar, status: "dikembalikan", cara_kirim: "antar" })).toBe(0);
    expect(S.totalTagihan({ ...dasar, status: "dicek", estimasi_biaya: 0 })).toBe(0);
  });
});

describe("linkWA (field url terhitung untuk pemilik toko)", () => {
  const opsi = { toko: "Cupil Stuff", situs: "https://cupilstuff.id" };
  const t = (lain: Record<string, unknown> = {}) => ({
    nomor: "SRV-261121-ABCD", nama: "Budi", wa: "6281234567890", status: "menunggu_perangkat",
    cara_kirim: "kurir", estimasi_biaya: 0, biaya_final: 0, ongkir_kirim_balik: 20_000, resi: "", ...lain,
  });
  const teks = (url: string) => decodeURIComponent(url.split("?text=")[1] ?? "");

  it("belum ada yang berlaku saat menunggu perangkat", () => {
    expect(S.linkWA(t(), opsi)).toEqual({ link_wa_diterima: "", link_wa_estimasi: "", link_wa_selesai: "", link_wa_lunas: "", link_wa_resi: "" });
  });
  it("diterima → link ke nomor pembeli dengan nomor tiket dan tautan cek-tiket", () => {
    const l = S.linkWA(t({ status: "diterima" }), opsi);
    expect(l.link_wa_diterima).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(teks(l.link_wa_diterima)).toContain("SRV-261121-ABCD");
    expect(teks(l.link_wa_diterima)).toContain("https://cupilstuff.id/cek-tiket?nomor=SRV-261121-ABCD");
  });
  it("estimasi menyebut nominal dan ongkir kirim balik bila ditolak", () => {
    const l = S.linkWA(t({ status: "menunggu_persetujuan", estimasi_biaya: 75_000 }), opsi);
    expect(teks(l.link_wa_estimasi)).toContain("Rp 75.000");
    expect(teks(l.link_wa_estimasi)).toContain("Rp 20.000");
  });
  it("selesai menyebut total = biaya + ongkir; dikembalikan antar = tanpa biaya", () => {
    expect(teks(S.linkWA(t({ status: "selesai", biaya_final: 80_000 }), opsi).link_wa_selesai)).toContain("Total: *Rp 100.000*");
    expect(teks(S.linkWA(t({ status: "dikembalikan", cara_kirim: "antar" }), opsi).link_wa_selesai)).toContain("Tidak ada biaya");
    expect(S.linkWA(t({ status: "selesai", biaya_final: 0, estimasi_biaya: 0 }), opsi).link_wa_selesai).toBe("");
  });
  it("lunas → link_wa_lunas dengan total; belum lunas → kosong", () => {
    expect(teks(S.linkWA(t({ status: "selesai", biaya_final: 80_000, status_bayar: "lunas" }), opsi).link_wa_lunas)).toContain("Rp 100.000");
    expect(S.linkWA(t({ status: "selesai", biaya_final: 80_000, status_bayar: "belum" }), opsi).link_wa_lunas).toBe("");
    expect(S.linkWA(t({ status: "dikirim", biaya_final: 80_000 }), opsi).link_wa_selesai).not.toBe("");
  });
  it("resi → link pelacakan", () => {
    expect(teks(S.linkWA(t({ status: "dikirim", resi: "JX123" }), opsi).link_wa_resi)).toContain("JX123");
  });
  it("format rupiah tidak bergantung locale", () => {
    expect(S.rp(1_234_567)).toBe("Rp 1.234.567");
    expect(S.rp(5_000)).toBe("Rp 5.000");
  });
});

describe("responsPublik (/api/tiket) tidak membocorkan data pribadi", () => {
  const rahasia = {
    nomor: "SRV-261121-ABCD", status: "selesai", perangkat: "Logitech G102", cara_kirim: "kurir",
    estimasi_biaya: 75_000, biaya_final: 80_000, ongkir_kirim_balik: 20_000, created: "2026-11-21", updated: "2026-11-22",
    // data pribadi yang TIDAK boleh keluar walau ikut diberikan
    nama: "Budi Rahasia", wa: "6281234567890", keluhan: "keluhan rahasia", foto: ["a.jpg"], provinsi: "Jawa Barat",
    alamat: "Jl. Rahasia", link_wa_selesai: "https://wa.me/6281234567890",
  };
  const r = S.responsPublik(rahasia, "Ganti switch mouse");

  it("hanya field yang diizinkan", () => {
    expect(Object.keys(r).sort()).toEqual(
      ["biaya_final", "dibuat", "diperbarui", "estimasi_biaya", "jasa", "nomor", "ongkir_kirim_balik", "perangkat", "status", "status_label", "tagihan"].sort(),
    );
  });
  it("tidak ada nama, WA, keluhan, foto, provinsi, alamat, atau link WA di mana pun", () => {
    const json = JSON.stringify(r);
    for (const bocor of ["Budi Rahasia", "6281234567890", "keluhan rahasia", "a.jpg", "Jawa Barat", "Jl. Rahasia", "wa.me"]) expect(json).not.toContain(bocor);
  });
  it("tagihan dihitung di server", () => {
    expect(r.tagihan).toMatchObject({ total: 100_000 });
    expect(r.jasa).toBe("Ganti switch mouse");
  });
});
