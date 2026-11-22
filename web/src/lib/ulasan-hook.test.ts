// Logika ulasan di server (pocketbase/pb_hooks/ulasan.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const U = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/ulasan.js");

const isian = (lain: Record<string, unknown> = {}) => ({
  bintang: 5,
  komentar: "Produk bagus, pengiriman cepat.",
  nama_tampil: "Budi",
  izin_tampil: true,
  ...lain,
});

describe("buatToken", () => {
  it("32 karakter dari huruf/angka yang tidak tertukar", () => {
    const t = U.buatToken(() => 0);
    expect(t).toHaveLength(32);
    for (let i = 0; i < 200; i++) {
      const tok = U.buatToken(Math.random);
      expect(tok).toMatch(/^[A-HJ-NP-Za-km-z2-9]{32}$/);
    }
  });
  it("token berbeda antar panggilan (acak)", () => {
    const set = new Set(Array.from({ length: 50 }, () => U.buatToken(Math.random)));
    expect(set.size).toBe(50);
  });
});

describe("tokenWajar", () => {
  it("panjang 20–100 huruf/angka diterima", () => {
    expect(U.tokenWajar("a".repeat(20))).toBe(true);
    expect(U.tokenWajar("abcDEF123")).toBe(false); // terlalu pendek
    expect(U.tokenWajar("a".repeat(101))).toBe(false); // terlalu panjang
    expect(U.tokenWajar("ada spasi")).toBe(false);
    expect(U.tokenWajar("ada-dash")).toBe(false);
    expect(U.tokenWajar("")).toBe(false);
    expect(U.tokenWajar(null)).toBe(false);
  });
});

describe("tokenKedaluwarsa", () => {
  const dibuat = "2026-01-01 00:00:00.000Z";
  it("token baru (dalam 30 hari) belum kedaluwarsa", () => {
    const t = Date.parse(dibuat);
    expect(U.tokenKedaluwarsa(dibuat, t + 29 * 86400_000)).toBe(false);
    expect(U.tokenKedaluwarsa(dibuat, t + 30 * 86400_000)).toBe(false); // tepat 30 hari masih berlaku
  });
  it("token lebih dari 30 hari kedaluwarsa", () => {
    const t = Date.parse(dibuat);
    expect(U.tokenKedaluwarsa(dibuat, t + 31 * 86400_000)).toBe(true);
  });
  it("created kosong / tidak valid dianggap tidak kedaluwarsa (record tanpa tanggal)", () => {
    expect(U.tokenKedaluwarsa("", Date.now())).toBe(false);
    expect(U.tokenKedaluwarsa("bukan tanggal", Date.now())).toBe(false);
  });
});

describe("validasiInput", () => {
  it("menolak isian kosong dengan pesan per field", () => {
    const v = U.validasiInput({});
    expect(v.ok).toBe(false);
    expect(v.galat.bintang).toBeTruthy();
  });

  it("bintang harus 1–5 bulat", () => {
    for (const b of [0, 6, 3.5, NaN]) expect(U.validasiInput(isian({ bintang: b })).ok, String(b)).toBe(false);
    for (const b of [1, 2, 3, 4, 5]) expect(U.validasiInput(isian({ bintang: b })).ok, String(b)).toBe(true);
  });

  it("komentar maksimal 500 huruf, boleh kosong", () => {
    expect(U.validasiInput(isian({ komentar: "a".repeat(500) })).ok).toBe(true);
    expect(U.validasiInput(isian({ komentar: "a".repeat(501) })).galat.komentar).toBeTruthy();
    expect(U.validasiInput(isian({ komentar: "" })).ok).toBe(true);
  });

  it("nama tampil maksimal 60 huruf, boleh kosong", () => {
    expect(U.validasiInput(isian({ nama_tampil: "a".repeat(60) })).ok).toBe(true);
    expect(U.validasiInput(isian({ nama_tampil: "a".repeat(61) })).galat.nama_tampil).toBeTruthy();
    expect(U.validasiInput(isian({ nama_tampil: "" })).ok).toBe(true);
  });

  it("izin_tampil dinormalkan dari berbagai bentuk checkbox", () => {
    expect(U.validasiInput(isian({ izin_tampil: true })).data.izin_tampil).toBe(true);
    expect(U.validasiInput(isian({ izin_tampil: "on" })).data.izin_tampil).toBe(true);
    expect(U.validasiInput(isian({ izin_tampil: "true" })).data.izin_tampil).toBe(true);
    expect(U.validasiInput(isian({ izin_tampil: false })).data.izin_tampil).toBe(false);
    expect(U.validasiInput(isian({ izin_tampil: "false" })).data.izin_tampil).toBe(false);
  });

  it("teks dirapikan", () => {
    const v = U.validasiInput(isian({ komentar: "  baris   pertama \n\n\n\n kedua  ", nama_tampil: "  Budi   Santoso " }));
    expect(v.data.komentar).toBe("baris pertama \n\n kedua");
    expect(v.data.nama_tampil).toBe("Budi Santoso");
  });
});

describe("validasiFoto", () => {
  const kb = (n: number) => ({ size: n * 1024 });
  it("0–3 foto kecil diterima", () => {
    expect(U.validasiFoto([])).toBe("");
    expect(U.validasiFoto([kb(300), kb(400), kb(500)])).toBe("");
  });
  it("lebih dari 3 foto, foto > 5 MB, atau foto kosong ditolak", () => {
    expect(U.validasiFoto([kb(100), kb(100), kb(100), kb(100)])).toMatch(/Maksimal 3/);
    expect(U.validasiFoto([kb(5 * 1024 + 1)])).toMatch(/5 MB/);
    expect(U.validasiFoto([{ size: 0 }])).toBeTruthy();
  });
});

describe("labelSumber", () => {
  it("terverifikasi → Pembeli terverifikasi", () => {
    expect(U.labelSumber(true, "situs")).toBe("Pembeli terverifikasi");
    expect(U.labelSumber(true, "whatsapp")).toBe("Pembeli terverifikasi");
  });
  it("belum terverifikasi → label sumbernya", () => {
    expect(U.labelSumber(false, "whatsapp")).toBe("via WhatsApp");
    expect(U.labelSumber(false, "marketplace")).toBe("dari marketplace");
    expect(U.labelSumber(false, "lainnya")).toBe("dari pelanggan");
  });
});

describe("responsPublik: hanya field tampilan", () => {
  const u = {
    id: "abc", jenis: "produk", produk: "p1", jasa: "", bintang: 5, komentar: "bagus",
    foto: ["a.jpg", "b.jpg"], nama_tampil: "Budi", sumber: "situs", terverifikasi: true, unggulan: true,
    // data pribadi yang TIDAK boleh keluar
    pesanan: "pesanan-rahasia", tiket: "tiket-rahasia", token: "TOKENRAHASIA",
    wa: "6281234567890", nama: "Budi Rahasia",
  };
  const r = U.responsPublik(u as never);

  it("hanya field yang diizinkan", () => {
    expect(Object.keys(r).sort()).toEqual(
      ["id", "jenis", "produk", "jasa", "bintang", "komentar", "foto", "nama_tampil", "sumber", "terverifikasi"].sort(),
    );
  });
  it("tidak ada relasi pesanan/tiket, token, WA, atau nama pribadi di mana pun", () => {
    const json = JSON.stringify(r);
    for (const bocor of ["pesanan-rahasia", "tiket-rahasia", "TOKENRAHASIA", "6281234567890", "Budi Rahasia", "token", "pesanan", "tiket"]) {
      expect(json).not.toContain(bocor);
    }
  });
  it("fallback nama anonim bila nama_tampil kosong", () => {
    expect(U.responsPublik({ ...u, nama_tampil: "" } as never).nama_tampil).toBe("Anonim");
  });
});