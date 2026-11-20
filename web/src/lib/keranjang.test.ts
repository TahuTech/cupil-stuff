import { describe, expect, it } from "vitest";
import { ringkasKeranjang, type InfoVarian } from "./keranjang";

const produk = { kode: "EDC-001", nama: "Pisau", foto: null, jumlahVarian: 2, warna: [] };
const v = (id: string, harga: number, stok: number, preorder = false, beratKirim = 250): InfoVarian => ({
  id, kode: `EDC-001-${id}`, nama: id, harga, beratKirim, stok, preorder, produk,
});
const data = { a: v("a", 150_000, 3), b: v("b", 175_000, 0), c: v("c", 50_000, 0, true, 100) };

describe("ringkasKeranjang", () => {
  it("menghitung subtotal dan berat dari data build, bukan dari keranjang", () => {
    const r = ringkasKeranjang([{ varian: "a", jumlah: 2, warna: null }], data);
    expect(r.subtotal).toBe(300_000);
    expect(r.beratGram).toBe(500);
    expect(r.baris[0].status).toBe("ok");
  });

  it("varian hilang dan habis ditandai dan tidak ikut checkout", () => {
    const r = ringkasKeranjang(
      [
        { varian: "a", jumlah: 1, warna: null },
        { varian: "b", jumlah: 1, warna: null },
        { varian: "zzz", jumlah: 4, warna: null },
      ],
      data,
    );
    expect(r.baris.map((b) => b.status)).toEqual(["ok", "habis", "hilang"]);
    expect(r.untukCheckout).toEqual([{ varian: "a", jumlah: 1, warna: null }]);
    expect(r.subtotal).toBe(150_000);
    expect(r.jumlahBarang).toBe(1);
  });

  it("jumlah dibatasi stok, kecuali pre-order", () => {
    const r = ringkasKeranjang(
      [
        { varian: "a", jumlah: 5, warna: null },
        { varian: "c", jumlah: 10, warna: "Merah" },
      ],
      data,
    );
    expect(r.baris[0]).toMatchObject({ jumlahDipakai: 3, status: "dikurangi", subtotal: 450_000 });
    expect(r.baris[1]).toMatchObject({ jumlahDipakai: 10, status: "ok", subtotal: 500_000, berat: 1000 });
    expect(r.subtotal).toBe(950_000);
    expect(r.beratGram).toBe(1750);
  });

  it("keranjang kosong", () => {
    expect(ringkasKeranjang([], data)).toMatchObject({ subtotal: 0, beratGram: 0, untukCheckout: [] });
  });
});
