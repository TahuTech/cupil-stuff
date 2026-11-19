import { describe, expect, it } from "vitest";
import { beratDitagihKg, hitungOngkir, potonganOngkir } from "./ongkir";

describe("beratDitagihKg (toleransi J&T 0,3 kg, minimal 1 kg)", () => {
  it.each([
    [0, 1],
    [600, 1],
    [1000, 1],
    [1300, 1],
    [1400, 2],
    [2000, 2],
    [2300, 2],
    [2310, 3],
    [5000, 5],
  ])("%i g → %i kg", (gram, kg) => {
    expect(beratDitagihKg(gram)).toBe(kg);
  });
});

describe("potonganOngkir (Rp5.000 per kelipatan Rp100.000, maks. sebesar ongkir)", () => {
  it.each([
    [99_999, 20_000, 0],
    [100_000, 20_000, 5_000],
    [150_000, 20_000, 5_000],
    [200_000, 20_000, 10_000],
    [1_000_000, 20_000, 20_000], // dibatasi ongkir
    [300_000, 8_000, 8_000],
  ])("subtotal %i, ongkir %i → potongan %i", (subtotal, ongkir, potongan) => {
    expect(potonganOngkir(subtotal, ongkir)).toBe(potongan);
  });
});

describe("hitungOngkir", () => {
  it("contoh CLAUDE.md: Jawa, 0,6 kg, subtotal Rp150.000 → bayar Rp15.000", () => {
    expect(hitungOngkir(600, 20_000, 150_000)).toEqual({
      otomatis: true,
      beratKg: 1,
      ongkir: 20_000,
      potongan: 5_000,
      dibayar: 15_000,
    });
  });

  it("tepat 5 kg masih dihitung otomatis", () => {
    const h = hitungOngkir(5000, 8_000, 0);
    expect(h.otomatis).toBe(true);
  });

  it("di atas 5 kg → dikonfirmasi via WhatsApp", () => {
    const h = hitungOngkir(5001, 20_000, 0);
    expect(h.otomatis).toBe(false);
  });
});
