import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { normalisasiWA, validasiIsian } from "./checkout";

const hook = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/pesanan.js");

describe("validasi browser = validasi server", () => {
  const contohWA = ["0812-3456-7890", "+62 812 3456 7890", "81234567890", "6285712345678", "12345", "0212345678", "", "08123", "0812345678901234", "62812345678901"];
  it.each(contohWA)("normalisasiWA(%j) sama", (wa) => expect(normalisasiWA(wa)).toBe(hook.normalisasiWA(wa)));

  const contohIsian = [
    { nama: "Budi", wa: "081234567890", alamat: "Jl. Contoh No. 1, Bandung", provinsi: "Jawa Barat" },
    { nama: "B", wa: "081234567890", alamat: "Jl. Contoh No. 1, Bandung", provinsi: "Jawa Barat" },
    { nama: "Budi", wa: "0812", alamat: "pendek", provinsi: "" },
    { nama: "  Budi   Santoso ", wa: "+6281234567890", alamat: "Jl. Contoh\n\nNo. 1", provinsi: "Kota Surabaya" },
    { nama: "a".repeat(81), wa: "081234567890", alamat: "a".repeat(501), provinsi: "Bali" },
  ];
  it.each(contohIsian)("field yang ditolak sama: %j", (isian) => {
    const browser = Object.keys(validasiIsian(isian)).sort();
    const server = hook.validasiInput({ ...isian, items: [{ varian: "aaaaaaaaaaaaaa1", jumlah: 1 }] });
    expect(browser).toEqual(server.ok ? [] : Object.keys(server.galat).sort());
  });
});
