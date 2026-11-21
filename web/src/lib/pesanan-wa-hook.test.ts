// Turunan pesanan untuk pemilik toko (pocketbase/pb_hooks/pesanan.wa.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const W = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/pesanan.wa.js");
const teks = (url: string) => decodeURIComponent(url.split("?text=")[1] ?? "");
const opsi = { toko: "Cupil Stuff", situs: "https://toko.contoh" };
const p = (lain: Record<string, unknown> = {}) => ({
  nomor: "CS-261121-ABCD", pembeli: "Budi", wa: "6281234567890", total: 305_000,
  ongkir_konfirmasi: false, status_bayar: "menunggu", resi: "", ...lain,
});

describe("ongkirManual", () => {
  it("ongkir diisi untuk pesanan yang butuh konfirmasi → potongan dan total dihitung ulang", () => {
    expect(W.ongkirManual({ ongkir_konfirmasi: true, ongkir: 105_000, subtotal: 425_000 })).toEqual({
      potongan_ongkir: 20_000, total: 510_000, ongkir_konfirmasi: false,
    });
  });
  it("potongan tidak melebihi ongkir", () => {
    expect(W.ongkirManual({ ongkir_konfirmasi: true, ongkir: 10_000, subtotal: 1_000_000 })).toMatchObject({ potongan_ongkir: 10_000, total: 1_000_000 });
  });
  it("tidak berubah jika ongkir belum diisi atau pesanan biasa", () => {
    expect(W.ongkirManual({ ongkir_konfirmasi: true, ongkir: 0, subtotal: 425_000 })).toBeNull();
    expect(W.ongkirManual({ ongkir_konfirmasi: false, ongkir: 20_000, subtotal: 150_000 })).toBeNull();
  });
});

describe("linkWA pesanan", () => {
  it("menunggu bayar → link_wa_ongkir berisi total dan tautan /bayar dari SITE_URL", () => {
    const l = W.linkWA(p(), opsi);
    expect(l.link_wa_ongkir).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(teks(l.link_wa_ongkir)).toContain("Rp 305.000");
    expect(teks(l.link_wa_ongkir)).toContain("https://toko.contoh/bayar?nomor=CS-261121-ABCD");
    expect(l.link_wa_lunas).toBe("");
  });
  it("tanpa SITE_URL tidak ada tautan (tidak ada domain tertulis di kode)", () => {
    const t = teks(W.linkWA(p(), { toko: "Cupil Stuff", situs: "" }).link_wa_ongkir);
    expect(t).not.toMatch(/https?:\/\/(?!wa\.me)/);
  });
  it("ongkir belum dikonfirmasi → belum ada link ongkir", () => {
    expect(W.linkWA(p({ ongkir_konfirmasi: true }), opsi).link_wa_ongkir).toBe("");
  });
  it("lunas → link_wa_lunas; link ongkir hilang", () => {
    const l = W.linkWA(p({ status_bayar: "lunas" }), opsi);
    expect(teks(l.link_wa_lunas)).toContain("sudah kami terima");
    expect(l.link_wa_ongkir).toBe("");
  });
  it("resi → link_wa_resi dengan halaman lacak J&T; resi diganti → link ikut berubah", () => {
    expect(teks(W.linkWA(p({ status_bayar: "lunas", resi: "JX1" }), opsi).link_wa_resi)).toContain("JX1");
    expect(teks(W.linkWA(p({ status_bayar: "lunas", resi: "JX2" }), opsi).link_wa_resi)).toContain("https://jet.co.id/track");
  });
});
