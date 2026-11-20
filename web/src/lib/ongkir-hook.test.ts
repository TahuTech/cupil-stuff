// Modul hitungan ongkir di hook PocketBase (pocketbase/pb_hooks/ongkir.js) harus
// menghasilkan angka yang SAMA dengan web/src/lib/ongkir.ts untuk semua masukan.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import * as web from "./ongkir";

const hook = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/ongkir.js");

const TARIF = [8_000, 20_000, 35_000, 50_000, 75_000, 100_000];
const SUBTOTAL = [0, 50_000, 99_999, 100_000, 150_000, 200_000, 999_999, 1_000_000, 3_500_000];

describe("ongkir hook = ongkir web", () => {
  it("beratDitagihKg sama untuk 0–8000 g (per 10 g)", () => {
    for (let g = 0; g <= 8000; g += 10) expect(hook.beratDitagihKg(g), `${g} g`).toBe(web.beratDitagihKg(g));
  });

  it("potonganOngkir sama", () => {
    for (const s of SUBTOTAL) for (const o of [0, 8_000, 20_000, 100_000, 500_000]) {
      expect(hook.potonganOngkir(s, o), `${s}/${o}`).toBe(web.potonganOngkir(s, o));
    }
  });

  it("hitungOngkir dan ringkasBayar sama untuk kombinasi berat × tarif × subtotal", () => {
    let n = 0;
    for (let g = 0; g <= 7000; g += 50) {
      for (const t of TARIF) for (const s of SUBTOTAL) {
        expect(hook.hitungOngkir(g, t, s)).toEqual(web.hitungOngkir(g, t, s));
        expect(hook.ringkasBayar(s, g, { tarifPerKg: t })).toEqual(web.ringkasBayar(s, g, { tarifPerKg: t }));
        n++;
      }
    }
    expect(hook.ringkasBayar(80_000, 300, null)).toEqual(web.ringkasBayar(80_000, 300, null));
    expect(n).toBeGreaterThan(7000);
  });

  it("batas otomatis sama", () => {
    expect(hook.BATAS_OTOMATIS_KG).toBe(web.BATAS_OTOMATIS_KG);
  });
});
