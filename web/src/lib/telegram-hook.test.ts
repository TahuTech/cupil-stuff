// Isi notifikasi Telegram untuk pemilik toko (pocketbase/pb_hooks/telegram.js).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const T = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/telegram.js");
const API = "https://api.toko.contoh";

describe("pesanPesanan", () => {
  it("pesanan biasa: nomor, total, jumlah barang, link ke record admin", () => {
    const t = T.pesanPesanan({ id: "abc123", nomor: "CS-261121-ABCD", total: 390_000, jumlah_barang: 3, ongkir_konfirmasi: false, provinsi: "Jawa Barat" }, API);
    expect(t).toBe("🛒 Pesanan baru CS-261121-ABCD\nTotal: Rp 390.000 (3 barang), ke Jawa Barat\nhttps://api.toko.contoh/_/#/collections?collection=pesanan&record=abc123");
  });
  it("di atas 5 kg: ditandai perlu konfirmasi ongkir", () => {
    const t = T.pesanPesanan({ id: "x", nomor: "CS-1", total: 425_000, jumlah_barang: 5, ongkir_konfirmasi: true, alasan: "Berat 6,0 kg (di atas 5 kg): isi ongkir manual di panel admin.", provinsi: "Bali" }, API);
    expect(t).toContain("ongkir perlu dikonfirmasi");
    expect(t).toContain("Total barang: Rp 425.000");
    expect(t).toContain("Berat 6,0 kg");
  });
  it("tanpa API_URL tidak ada link", () => {
    expect(T.pesanPesanan({ id: "x", nomor: "CS-1", total: 1, jumlah_barang: 1, ongkir_konfirmasi: false, provinsi: "Bali" }, "")).not.toContain("http");
  });
});

describe("pesanTiket", () => {
  it("nomor, jasa, perangkat, cara kirim, link", () => {
    const t = T.pesanTiket({ id: "t1", nomor: "SRV-261121-ABCD", jasa: "Ganti switch mouse", perangkat_jenis: "mouse", perangkat: "Logitech G102", cara_kirim: "kurir" }, API + "/");
    expect(t).toBe("🔧 Tiket servis baru SRV-261121-ABCD\nJasa: Ganti switch mouse\nPerangkat: mouse, Logitech G102\nCara kirim: kurir\nhttps://api.toko.contoh/_/#/collections?collection=tiket_servis&record=t1");
  });
  it("jasa belum dipilih", () => {
    expect(T.pesanTiket({ id: "t1", nomor: "SRV-1", jasa: "", perangkat_jenis: "keyboard", perangkat: "Rexus", cara_kirim: "antar" }, "")).toContain("Jasa: belum dipilih");
  });
});

describe("kirim", () => {
  it("token/chat id kosong → dilewati diam-diam (false, tanpa galat)", () => {
    (globalThis as Record<string, unknown>).$os = { getenv: () => "" };
    expect(T.kirim("halo")).toBe(false);
  });
  it("galat jaringan tidak pernah dilempar", () => {
    (globalThis as Record<string, unknown>).$os = { getenv: (k: string) => (k.startsWith("TELEGRAM_") && k !== "TELEGRAM_API_URL" ? "isi" : "") };
    (globalThis as Record<string, unknown>).$http = { send: () => { throw new Error("koneksi putus"); } };
    (globalThis as Record<string, unknown>).$app = { logger: () => ({ warn: () => {} }) };
    expect(T.kirim("halo")).toBe(false);
  });
});
