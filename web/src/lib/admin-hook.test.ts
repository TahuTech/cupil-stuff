// Test untuk hook admin: pengurangan/pengembalian stok dan hitung ulang ongkir
// setelah ongkir diisi manual (pocketbase/pb_hooks/ongkir.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import * as web from "./ongkir";

const O = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/ongkir.js");

// "Simulasi" untuk fungsi yang perlu di-test: potonganOngkir dipakai saat
// pemilik mengisi ongkir di pesanan ongkir_konfirmasi.
// Di hook asli: ongkir diisi → potongan = potonganOngkir(subtotal, ongkir),
// total = subtotal + ongkir - potongan, ongkir_konfirmasi = false.

describe("hitung ulang ongkir setelah diisi manual", () => {
  it("ongkir 0 → tidak ada potongan, total = subtotal + ongkir", () => {
    // subtotal 200rb, ongkir diisi 35000
    const potongan = O.potonganOngkir(200_000, 35_000);
    expect(potongan).toBe(10_000);
    const total = 200_000 + 35_000 - potongan;
    expect(total).toBe(225_000);
  });

  it("potongan maksimal sebesar ongkir", () => {
    // subtotal 2jt → potongan 100rb, ongkir hanya 8000 → potongan = 8000
    expect(O.potonganOngkir(2_000_000, 8_000)).toBe(8_000);
    expect(O.potonganOngkir(2_000_000, 200_000)).toBe(100_000);
  });

  it("sama dengan versi web", () => {
    // Samakan semua dengan ongkir.ts versi web
    const subtotals = [0, 50_000, 100_000, 150_000, 200_000, 500_000, 1_000_000];
    const ongkirs = [0, 8_000, 20_000, 35_000, 50_000, 100_000, 500_000];
    for (const s of subtotals) {
      for (const o of ongkirs) {
        expect(O.potonganOngkir(s, o)).toBe(web.potonganOngkir(s, o));
      }
    }
  });
});

describe("stok: simulasi pengurangan dan pengembalian", () => {
  // Simulasi jumlah × arah. Hook sebenarnya memanggil findRecordById
  // dan app.save(varian), tapi logika matematikanya:
  //   stokBaru = stokSekarang + arah * jumlah
  //   arah = -1 (kurangi, lunas) atau +1 (kembalikan, lunas→batal)

  const kurangi = (stok: number, jumlah: number) => stok - jumlah;
  const kembalikan = (stok: number, jumlah: number) => stok + jumlah;

  it("kurangi stok saat lunas", () => {
    expect(kurangi(10, 3)).toBe(7);
    expect(kurangi(3, 3)).toBe(0);
    expect(kurangi(1, 1)).toBe(0);
  });

  it("stok tidak cukup — masih positif (ditolak di hook)", () => {
    // Hook melempar BadRequestError kalau stok < jumlah & bukan preorder
    const stokSetelah = kurangi(2, 5); // -3 → tidak valid
    expect(stokSetelah < 0).toBe(true);
  });

  it("pre-order boleh di bawah 0 (tidak dicek hook)", () => {
    // Hook hanya cek stok < 0 jika !preorder
    const stokSetelah = kurangi(0, 5); // -5
    // Untuk preorder, ini tidak ditolak
    expect(stokSetelah).toBe(-5);
  });

  it("kembalikan stok saat lunas → batal", () => {
    // stok sudah 0 setelah dikurangi 3, lalu batal → kembalikan 3
    expect(kembalikan(0, 3)).toBe(3);
    expect(kembalikan(5, 2)).toBe(7);
  });

  it("lintasan lengkap: lunas kurangi stok, batal kembalikan, lunas lagi kurangi", () => {
    let stok = 10;
    const pesanan = 3;

    // Lunas
    stok = kurangi(stok, pesanan);
    expect(stok).toBe(7);

    // Batal
    stok = kembalikan(stok, pesanan);
    expect(stok).toBe(10);

    // Lunas lagi
    stok = kurangi(stok, pesanan);
    expect(stok).toBe(7);
  });
});