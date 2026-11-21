// Perubahan stok saat status bayar pesanan berubah (pocketbase/pb_hooks/pesanan.stok.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const K = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/pesanan.stok.js");

describe("arahStok", () => {
  it.each([
    ["menunggu", "lunas", -1],
    ["batal", "lunas", -1],
    ["lunas", "batal", 1],
    ["lunas", "menunggu", 1],
    ["menunggu", "batal", 0],
    ["lunas", "lunas", 0],
  ])("%s → %s = %i", (lama, baru, arah) => expect(K.arahStok(lama, baru)).toBe(arah));
});

describe("rencanaStok", () => {
  const varian = { a: { stok: 3, preorder: false }, b: { stok: 1, preorder: false }, po: { stok: 0, preorder: true } };

  it("lunas: kurangi semua varian", () => {
    expect(K.rencanaStok([{ varian: "a", jumlah: 2 }, { varian: "b", jumlah: 1 }], varian, -1)).toEqual({
      ok: true, perubahan: [{ id: "a", stok: 1 }, { id: "b", stok: 0 }],
    });
  });
  it("batal setelah lunas: kembalikan", () => {
    expect(K.rencanaStok([{ varian: "a", jumlah: 2 }], varian, 1).perubahan).toEqual([{ id: "a", stok: 5 }]);
  });
  it("satu varian kurang → tidak ada perubahan sama sekali", () => {
    const r = K.rencanaStok([{ varian: "a", jumlah: 1 }, { varian: "b", jumlah: 2, nama: "Figur" }], varian, -1);
    expect(r).toEqual({ ok: false, masalah: ["Figur: stok tinggal 1, butuh 2"] });
  });
  it("varian sama dengan warna berbeda dijumlahkan", () => {
    const r = K.rencanaStok([{ varian: "a", jumlah: 2, nama: "Pisau" }, { varian: "a", jumlah: 2, nama: "Pisau" }], varian, -1);
    expect(r.ok).toBe(false);
  });
  it("pre-order tidak ditolak dan stok tidak di bawah 0", () => {
    expect(K.rencanaStok([{ varian: "po", jumlah: 4 }], varian, -1)).toEqual({ ok: true, perubahan: [{ id: "po", stok: 0 }] });
  });
  it("varian yang sudah dihapus dilewati", () => {
    expect(K.rencanaStok([{ varian: "hilang", jumlah: 1 }, { varian: "a", jumlah: 1 }], varian, -1).perubahan).toEqual([{ id: "a", stok: 2 }]);
  });
});
