import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { validasiPilihanFoto, validasiServis, type IsianServis } from "./servis";

const hook = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/servis.js");

const dasar: IsianServis = {
  nama: "Budi", wa: "081234567890", perangkat_jenis: "mouse", perangkat: "Logitech G102",
  keluhan: "Double click dan scroll lompat", cara_kirim: "kurir", provinsi: "Jawa Barat", jasa: "",
};

describe("validasi form servis: browser = server", () => {
  const contoh: Partial<IsianServis>[] = [
    {},
    { nama: "B" },
    { nama: "  Budi   Santoso " },
    { nama: "a".repeat(81) },
    { wa: "021555123" },
    { wa: "+62 812 3456 7890" },
    { perangkat_jenis: "laptop" },
    { perangkat: "G" },
    { perangkat: "a".repeat(81) },
    { keluhan: "rusak" },
    { keluhan: "a".repeat(1001) },
    { keluhan: "baris\n\n\n\nbanyak sekali" },
    { cara_kirim: "ojol" },
    { provinsi: "" },
    { provinsi: "a".repeat(61) },
    { cara_kirim: "antar", provinsi: "" },
    { jasa: "bukan-id" },
    { jasa: "aaaaaaaaaaaaaa1" },
    { nama: "", wa: "", perangkat_jenis: "", perangkat: "", keluhan: "", cara_kirim: "", provinsi: "" },
  ];
  it.each(contoh)("field yang ditolak sama: %j", (ubah) => {
    const isian = { ...dasar, ...ubah };
    const server = hook.validasiInput(isian);
    const kunciServer = server.ok ? [] : Object.keys(server.galat).sort();
    expect(Object.keys(validasiServis(isian)).sort()).toEqual(kunciServer);
  });
  it("pesan galat sama persis", () => {
    const isian = { ...dasar, nama: "", wa: "1", perangkat_jenis: "", perangkat: "", keluhan: "", cara_kirim: "kurir", provinsi: "" };
    expect(validasiServis(isian)).toEqual(hook.validasiInput(isian).galat);
  });
});

describe("validasiPilihanFoto", () => {
  const jpg = { type: "image/jpeg" };
  it("0–5 gambar diterima", () => {
    expect(validasiPilihanFoto([])).toBe("");
    expect(validasiPilihanFoto([jpg, jpg, { type: "image/png" }, { type: "image/webp" }, jpg])).toBe("");
  });
  it("lebih dari 5 atau bukan gambar ditolak", () => {
    expect(validasiPilihanFoto(Array(6).fill(jpg))).toMatch(/Maksimal 5/);
    expect(validasiPilihanFoto([{ type: "application/pdf" }])).toMatch(/JPG, PNG, atau WebP/);
  });
});
