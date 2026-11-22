// Validasi ulasan di browser (web/src/lib/ulasan.ts): aturan sama dengan server
// (pocketbase/pb_hooks/ulasan.js), dijaga oleh ulasan-hook.test.ts.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { labelSumber, bintangTeks, validasiPilihanFotoUlasan, validasiUlasan, type IsianUlasan } from "./ulasan";

const hook = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/ulasan.js");

const dasar: IsianUlasan = { bintang: 5, komentar: "bagus", nama_tampil: "Budi", izin_tampil: true };

describe("validasiUlasan: browser = server", () => {
  const contoh: Partial<IsianUlasan>[] = [
    {},
    { bintang: 0 },
    { bintang: 6 },
    { bintang: 3.5 },
    { bintang: 1 },
    { bintang: 5 },
    { komentar: "a".repeat(500) },
    { komentar: "a".repeat(501) },
    { komentar: "" },
    { nama_tampil: "a".repeat(60) },
    { nama_tampil: "a".repeat(61) },
    { nama_tampil: "" },
  ];
  it.each(contoh)("field yang ditolak sama: %j", (ubah) => {
    const isian = { ...dasar, ...ubah };
    const browser = Object.keys(validasiUlasan(isian)).sort();
    const server = hook.validasiInput(isian);
    expect(browser).toEqual(server.ok ? [] : Object.keys(server.galat).sort());
  });
});

describe("labelSumber", () => {
  it("terverifikasi → Pembeli terverifikasi", () => {
    expect(labelSumber(true, "situs")).toBe("Pembeli terverifikasi");
    expect(labelSumber(true, "whatsapp")).toBe("Pembeli terverifikasi");
  });
  it("belum terverifikasi → label sumbernya (via WhatsApp / dari marketplace / lainnya)", () => {
    expect(labelSumber(false, "whatsapp")).toBe("via WhatsApp");
    expect(labelSumber(false, "marketplace")).toBe("dari marketplace");
    expect(labelSumber(false, "lainnya")).toBe("dari pelanggan");
  });
  it("sama dengan labelSumber di server", () => {
    for (const v of [true, false]) {
      for (const s of ["situs", "whatsapp", "marketplace", "lainnya"]) {
        expect(labelSumber(v, s)).toBe(hook.labelSumber(v, s));
      }
    }
  });
});

describe("validasiPilihanFotoUlasan", () => {
  const jpg = { type: "image/jpeg" };
  it("0–3 gambar diterima", () => {
    expect(validasiPilihanFotoUlasan([])).toBe("");
    expect(validasiPilihanFotoUlasan([jpg, jpg, { type: "image/png" }])).toBe("");
  });
  it("lebih dari 3 atau bukan gambar ditolak", () => {
    expect(validasiPilihanFotoUlasan([jpg, jpg, jpg, jpg])).toMatch(/Maksimal 3/);
    expect(validasiPilihanFotoUlasan([{ type: "application/pdf" }])).toMatch(/JPG, PNG, atau WebP/);
  });
});

describe("bintangTeks", () => {
  it.each([
    [0, "☆☆☆☆☆"],
    [1, "★☆☆☆☆"],
    [3, "★★★☆☆"],
    [5, "★★★★★"],
    [7, "★★★★★"],
  ])("%i → %s", (n, teks) => expect(bintangTeks(n)).toBe(teks));
});