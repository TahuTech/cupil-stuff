// Logika servis di server (pocketbase/pb_hooks/servis.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const S = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/servis.js");

const isian = (lain: Record<string, unknown> = {}) => ({
  nama: "Budi",
  wa: "0812-3456-7890",
  perangkat: "Logitech G102",
  keluhan: "Double click dan scroll lompat",
  cara_kirim: "kurir",
  ...lain,
});

describe("normalisasiWA (servis)", () => {
  it.each([
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["81234567890", "6281234567890"],
  ])("%s → %s", (masuk, hasil) => expect(S.normalisasiWA(masuk)).toBe(hasil));
  it.each(["12345", "0212345678", "", null, "08123"])("%s → null", (masuk) =>
    expect(S.normalisasiWA(masuk)).toBeNull(),
  );
});

describe("validasiInput (servis)", () => {
  it("menolak isian kosong dengan pesan per field", () => {
    const v = S.validasiInput({});
    expect(v.ok).toBe(false);
    expect(Object.keys(v.galat).sort()).toEqual(["cara_kirim", "keluhan", "nama", "perangkat", "wa"]);
  });

  it("isian lengkap diterima, WA dinormalisasi, nama dirapikan", () => {
    const v = S.validasiInput(isian({ nama: "  Budi   Santoso ", wa: "+62 812 3456 7890" }));
    expect(v.ok).toBe(true);
    expect(v.data).toMatchObject({ nama: "Budi Santoso", wa: "6281234567890", cara_kirim: "kurir", jasa: null });
  });

  it("cara_kirim harus kurir atau antar", () => {
    expect(S.validasiInput(isian({ cara_kirim: "ojol" })).galat.cara_kirim).toBeTruthy();
    expect(S.validasiInput(isian({ cara_kirim: "antar" })).ok).toBe(true);
  });

  it("keluhan minimal 10 huruf", () => {
    expect(S.validasiInput(isian({ keluhan: "rusak" })).galat.keluhan).toBeTruthy();
  });

  it("jasa opsional; id jasa divalidasi formatnya", () => {
    expect(S.validasiInput(isian({ jasa: "" })).data.jasa).toBeNull();
    expect(S.validasiInput(isian({ jasa: "bukan-id" })).galat.jasa).toBeTruthy();
    expect(S.validasiInput(isian({ jasa: "aaaaaaaaaaaaaa1" })).data.jasa).toBe("aaaaaaaaaaaaaa1");
  });

  it("nama/perangkat terlalu panjang ditolak", () => {
    expect(S.validasiInput(isian({ nama: "a".repeat(81) })).galat.nama).toBeTruthy();
    expect(S.validasiInput(isian({ perangkat: "a".repeat(81) })).galat.perangkat).toBeTruthy();
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

describe("LABEL_STATUS", () => {
  it("punya label untuk semua status tiket", () => {
    for (const s of ["menunggu_perangkat", "diterima", "dicek", "menunggu_persetujuan", "dikerjakan", "selesai", "dikirim", "dikembalikan"]) {
      expect(S.LABEL_STATUS[s], s).toBeTruthy();
    }
  });
});