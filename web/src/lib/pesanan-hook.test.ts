// Logika checkout di server (pocketbase/pb_hooks/pesanan.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const P = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/pesanan.js");

const ID = { satin: "aaaaaaaaaaaaaa1", habis: "aaaaaaaaaaaaaa2", figur: "aaaaaaaaaaaaaa3", draft: "aaaaaaaaaaaaaa4", po: "aaaaaaaaaaaaaa5" };
const sumber = {
  varian: {
    [ID.satin]: { id: ID.satin, kode: "EDC-001-1", nama: "Satin", harga: 150_000, berat_kirim: 250, stok: 3, preorder: false, produk: "p1" },
    [ID.habis]: { id: ID.habis, kode: "EDC-001-2", nama: "Black", harga: 175_000, berat_kirim: 250, stok: 0, preorder: false, produk: "p1" },
    [ID.figur]: { id: ID.figur, kode: "MDL-001-1", nama: "8 cm", harga: 85_000, berat_kirim: 150, stok: 5, preorder: false, produk: "p2" },
    [ID.draft]: { id: ID.draft, kode: "EDC-002-1", nama: "Std", harga: 35_000, berat_kirim: 100, stok: 9, preorder: false, produk: "p3" },
    [ID.po]: { id: ID.po, kode: "MDL-002-1", nama: "Besar", harga: 400_000, berat_kirim: 1_200, stok: 0, preorder: true, produk: "p2" },
  },
  produk: {
    p1: { id: "p1", kode: "EDC-001", nama: "Pisau", aktif: true, warna: [] },
    p2: { id: "p2", kode: "MDL-001", nama: "Figur", aktif: true, warna: ["Asli", "Merah"] },
    p3: { id: "p3", kode: "EDC-002", nama: "Peluit", aktif: false, warna: [] },
  },
  zona: [
    { id: "z1", nama: "Dalam kota", provinsi: ["Kota Surabaya"], tarif_per_kg: 8_000, estimasi: "1 hari" },
    { id: "z2", nama: "Jawa", provinsi: ["Jawa Barat", "Jawa Timur"], tarif_per_kg: 20_000, estimasi: "2–3 hari" },
  ],
};
const isian = (items: unknown[], lain: Record<string, unknown> = {}) => ({
  items, nama: "Budi", wa: "0812-3456-7890", alamat: "Jl. Contoh No. 1, Bandung", provinsi: "Jawa Barat", ...lain,
});
const hitung = (items: unknown[], lain?: Record<string, unknown>) => {
  const v = P.validasiInput(isian(items, lain));
  expect(v.ok).toBe(true);
  return P.hitungPesanan(v.data, sumber);
};

describe("normalisasiWA", () => {
  it.each([
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["81234567890", "6281234567890"],
    ["6285712345678", "6285712345678"],
  ])("%s → %s", (masuk, hasil) => expect(P.normalisasiWA(masuk)).toBe(hasil));
  it.each(["12345", "0212345678", "", null, "08123", "0812345678901234"])("%s → null", (masuk) => expect(P.normalisasiWA(masuk)).toBeNull());
});

describe("validasiInput", () => {
  it("menolak isian kosong dengan pesan per field", () => {
    const v = P.validasiInput({});
    expect(v.ok).toBe(false);
    expect(Object.keys(v.galat).sort()).toEqual(["alamat", "items", "nama", "provinsi", "wa"]);
  });
  it("maksimal 20 item", () => {
    const items = Array.from({ length: 21 }, () => ({ varian: ID.satin, jumlah: 1, warna: null }));
    expect(P.validasiInput(isian(items)).galat.items).toMatch(/Maksimal 20/);
  });
  it("menolak id varian, jumlah, atau warna yang tidak wajar", () => {
    for (const it of [{ varian: "x", jumlah: 1 }, { varian: ID.satin, jumlah: 0 }, { varian: ID.satin, jumlah: 1.5 }, { varian: ID.satin, jumlah: 100 }, { varian: ID.satin, jumlah: 1, warna: "w".repeat(41) }]) {
      expect(P.validasiInput(isian([it])).ok, JSON.stringify(it)).toBe(false);
    }
  });
  it("nama dan alamat terlalu panjang ditolak", () => {
    expect(P.validasiInput(isian([{ varian: ID.satin, jumlah: 1 }], { nama: "a".repeat(81) })).galat.nama).toBeTruthy();
    expect(P.validasiInput(isian([{ varian: ID.satin, jumlah: 1 }], { alamat: "a".repeat(501) })).galat.alamat).toBeTruthy();
  });
  it("varian + warna yang sama digabung", () => {
    const v = P.validasiInput(isian([{ varian: ID.satin, jumlah: 1, warna: null }, { varian: ID.satin, jumlah: 2, warna: null }]));
    expect(v.data.items).toEqual([{ varian: ID.satin, jumlah: 3, warna: null }]);
  });
});

describe("hitungPesanan", () => {
  it("menghitung ulang dari data server; angka dari browser diabaikan", () => {
    const h = hitung([{ varian: ID.satin, jumlah: 1, warna: null, harga: 1 }], { subtotal: 1, total: 1 });
    expect(h.ok).toBe(true);
    expect(h.pesanan).toMatchObject({ subtotal: 150_000, berat_gram: 250, berat_ditagih_kg: 1, ongkir: 20_000, potongan_ongkir: 5_000, total: 165_000, ongkir_konfirmasi: false });
    expect(h.pesanan.zona).toEqual({ id: "z2", nama: "Jawa", estimasi: "2–3 hari" });
  });
  it("dua barang ke Kota Surabaya", () => {
    const h = hitung([{ varian: ID.satin, jumlah: 2, warna: null }, { varian: ID.figur, jumlah: 1, warna: "Merah" }], { provinsi: "Kota Surabaya" });
    // 300.000 + 85.000 = 385.000; 650 g → 1 kg × 8.000; potongan 3 × 5.000 = 15.000 → dibatasi 8.000
    expect(h.pesanan).toMatchObject({ subtotal: 385_000, berat_gram: 650, ongkir: 8_000, potongan_ongkir: 8_000, total: 385_000 });
    expect(h.pesanan.items[1]).toMatchObject({ kode: "MDL-001-1", warna: "Merah", subtotal: 85_000 });
  });
  it("stok habis, stok kurang, produk nonaktif, varian tidak ada, warna salah → ditolak dengan alasan", () => {
    const h = hitung([
      { varian: ID.habis, jumlah: 1, warna: null },
      { varian: ID.satin, jumlah: 4, warna: null },
      { varian: ID.draft, jumlah: 1, warna: null },
      { varian: "zzzzzzzzzzzzzzz", jumlah: 1, warna: null },
      { varian: ID.figur, jumlah: 1, warna: "Ungu" },
    ]);
    expect(h.ok).toBe(false);
    expect(h.masalah.map((m: { pesan: string }) => m.pesan)).toEqual([
      "Pisau (Black): stok habis.",
      "Pisau (Satin): stok tinggal 3.",
      "Barang sudah tidak dijual.",
      "Barang sudah tidak dijual.",
      "Figur (8 cm): pilih warna yang tersedia.",
    ]);
  });
  it("produk tanpa pilihan warna: warna dari browser diabaikan", () => {
    expect(hitung([{ varian: ID.satin, jumlah: 1, warna: "Emas" }]).pesanan.items[0].warna).toBeNull();
  });
  it("pre-order boleh melebihi stok; di atas 5 kg → ongkir dikonfirmasi, total = subtotal", () => {
    const h = hitung([{ varian: ID.po, jumlah: 5, warna: "Asli" }]); // 6.000 g
    expect(h.pesanan).toMatchObject({ subtotal: 2_000_000, berat_gram: 6_000, berat_ditagih_kg: 6, ongkir: 0, potongan_ongkir: 0, total: 2_000_000, ongkir_konfirmasi: true });
  });
  it("provinsi tanpa zona → ongkir dikonfirmasi", () => {
    const h = hitung([{ varian: ID.satin, jumlah: 1, warna: null }], { provinsi: "Atlantis" });
    expect(h.pesanan).toMatchObject({ ongkir_konfirmasi: true, total: 150_000, zona: null });
  });
});

describe("buatNomor", () => {
  it("format CS-YYMMDD-XXXX dengan tanggal WIB", () => {
    // 2026-11-20 18:30 UTC = 2026-11-21 01:30 WIB
    expect(P.buatNomor(Date.UTC(2026, 10, 20, 18, 30), () => 0)).toBe("CS-261121-AAAA");
    expect(P.buatNomor(Date.UTC(2026, 0, 5, 3, 0), () => 0.999)).toMatch(/^CS-260105-9{4}$/);
  });
  it("hanya huruf yang tidak mudah tertukar", () => {
    for (let i = 0; i < 200; i++) expect(P.buatNomor(Date.now(), Math.random)).toMatch(/^CS-\d{6}-[A-HJ-NP-Z2-9]{4}$/);
  });
});
