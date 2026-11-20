import { describe, expect, it } from "vitest";
import { beratDitagihKg, cariZona, hitungOngkir, potonganOngkir, ringkasBayar } from "./ongkir";

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

describe("cariZona", () => {
  const zona = [
    { nama: "Dalam kota", provinsi: ["Kota Surabaya"], tarifPerKg: 8000 },
    { nama: "Jawa", provinsi: ["Jawa Timur", "DKI Jakarta"], tarifPerKg: 20000 },
  ];
  it("Kota Surabaya punya zona sendiri, Jawa Timur masuk zona Jawa", () => {
    expect(cariZona("Kota Surabaya", zona)?.nama).toBe("Dalam kota");
    expect(cariZona("Jawa Timur", zona)?.nama).toBe("Jawa");
  });
  it("provinsi tidak dikenal → null", () => {
    expect(cariZona("Atlantis", zona)).toBeNull();
  });
});

describe("ringkasBayar", () => {
  it("contoh CLAUDE.md: Jawa, 600 g, subtotal 150.000 → total 165.000", () => {
    expect(ringkasBayar(150_000, 600, { tarifPerKg: 20_000 })).toEqual({
      otomatis: true, beratKg: 1, ongkir: 20_000, potongan: 5_000, total: 165_000,
    });
  });
  it("potongan tidak melebihi ongkir: dalam kota, subtotal 1 juta", () => {
    expect(ringkasBayar(1_000_000, 900, { tarifPerKg: 8_000 })).toMatchObject({ ongkir: 8_000, potongan: 8_000, total: 1_000_000 });
  });
  it("di atas 5 kg → tidak otomatis, total = subtotal", () => {
    expect(ringkasBayar(200_000, 5_400, { tarifPerKg: 20_000 })).toMatchObject({ otomatis: false, beratKg: 6, total: 200_000 });
  });
  it("zona tidak ada → tidak otomatis, total = subtotal", () => {
    expect(ringkasBayar(80_000, 300, null)).toMatchObject({ otomatis: false, total: 80_000 });
  });
});
