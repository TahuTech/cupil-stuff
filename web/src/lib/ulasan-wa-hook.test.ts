// Logika token + tautan WA ulasan (pocketbase/pb_hooks/ulasan.wa.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const U = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/ulasan.wa.js");
const opsi = { toko: "Cupil Stuff", situs: "https://toko.contoh" };
const teks = (url: string) => decodeURIComponent(url.split("?text=")[1] ?? "");

describe("layak", () => {
  it("pesanan layak saat status_kirim dikirim/selesai", () => {
    expect(U.layak("pesanan", "dikirim")).toBe(true);
    expect(U.layak("pesanan", "selesai")).toBe(true);
    expect(U.layak("pesanan", "diproses")).toBe(false);
  });
  it("tiket layak saat status dikirim", () => {
    expect(U.layak("tiket", "dikirim")).toBe(true);
    expect(U.layak("tiket", "selesai")).toBe(false);
  });
});

describe("tokenUntuk", () => {
  const dibuat = "2026-01-01 00:00:00.000Z";
  const t0 = Date.parse(dibuat);
  it("token kosong → buat baru", () => {
    const t = U.tokenUntuk("", dibuat, t0, () => 0);
    expect(t.token).toHaveLength(32);
  });
  it("token masih berlaku → dipakai ulang", () => {
    const t = U.tokenUntuk("TOKEXISTING123", dibuat, t0 + 5 * 86400_000, () => 0);
    expect(t.token).toBe("TOKEXISTING123");
  });
  it("token kedaluwarsa → tidak diperpanjang (kedaluwarsa: true)", () => {
    const t = U.tokenUntuk("TOKEXISTING123", dibuat, t0 + 31 * 86400_000, () => 0);
    expect(t.kedaluwarsa).toBe(true);
  });
});

describe("linkUlasanWA", () => {
  const p = (lain: Record<string, unknown> = {}) => ({
    wa: "6281234567890", jenis: "pesanan", nama: "Budi", nomor: "CS-261121-ABCD",
    token: "TOKEN123", ...lain,
  });

  it("pesanan → link wa.me ke pembeli dengan tautan /ulasan?t=TOKEN", () => {
    const l = U.linkUlasanWA(p(), opsi);
    expect(l.link_wa_ulasan).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(teks(l.link_wa_ulasan)).toContain("https://toko.contoh/ulasan?t=TOKEN123");
    expect(teks(l.link_wa_ulasan)).toContain("berbelanja");
  });
  it("tiket → link wa.me dengan tautan /ulasan?t=TOKEN", () => {
    const l = U.linkUlasanWA(p({ jenis: "tiket" }), opsi);
    expect(teks(l.link_wa_ulasan)).toContain("https://toko.contoh/ulasan?t=TOKEN123");
    expect(teks(l.link_wa_ulasan)).toContain("servis");
  });
  it("token kosong / wa kosong → tidak ada link", () => {
    expect(U.linkUlasanWA(p({ token: "" }), opsi).link_wa_ulasan).toBe("");
    expect(U.linkUlasanWA(p({ wa: "" }), opsi).link_wa_ulasan).toBe("");
  });
  it("tanpa SITE_URL tidak ada tautan (tidak ada domain tertulis di kode)", () => {
    expect(U.linkUlasanWA(p(), { toko: "Cupil Stuff", situs: "" }).link_wa_ulasan).toBe("");
  });
  it("linkAdmin / labelJenis", () => {
    expect(U.labelJenis("servis")).toBe("ulasan servis");
    expect(U.labelJenis("produk")).toBe("ulasan produk");
  });
});

describe("pesanUlasanBaru (notifikasi Telegram)", () => {
  it("judul, bintang, nama, kutipan, dan link ke record admin", () => {
    const t = U.pesanUlasanBaru({ id: "u1", jenis: "produk", bintang: 5, nama_tampil: "Budi", terverifikasi: true, ringkas: "Mantap!" }, "https://api.toko.contoh");
    expect(t).toContain("Ulasan baru menunggu persetujuan");
    expect(t).toContain("ulasan produk · ⭐⭐⭐⭐⭐ (5/5)");
    expect(t).toContain("Dari: Budi (pembeli terverifikasi)");
    expect(t).toContain("“Mantap!”");
    expect(t).toContain("https://api.toko.contoh/_/#/collections?collection=ulasan&record=u1");
  });
  it("jenis servis dan tanpa verifikasi", () => {
    const t = U.pesanUlasanBaru({ id: "u2", jenis: "servis", bintang: 4, nama_tampil: "Sari", terverifikasi: false, ringkas: "" }, "");
    expect(t).toContain("ulasan servis · ⭐⭐⭐⭐ (4/5)");
    expect(t).toContain("Dari: Sari");
    expect(t).not.toContain("terverifikasi");
    expect(t).not.toContain("http");
  });
  it("tanpa nama → Anonim", () => {
    expect(U.pesanUlasanBaru({ id: "u3", jenis: "produk", bintang: 3, nama_tampil: "", terverifikasi: false, ringkas: "" }, "")).toContain("Dari: Anonim");
  });
});