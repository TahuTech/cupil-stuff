// Helper form servis di browser: validasi (aturan sama dengan pb_hooks/servis.js, dijaga
// oleh servis.test.ts), alamat route, pengecilan foto sebelum upload, dan tipe balasan.
// Validasi di sini hanya untuk kenyamanan; server tetap memeriksa ulang semuanya.

import { normalisasiWA } from "./checkout";

/** Saat dev: relatif (diteruskan proxy Vite). Saat build: PUBLIC_PB_URL. */
export function urlServis() {
  if (import.meta.env.DEV) return "/api/servis";
  const pb = (import.meta.env.PUBLIC_PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
  return `${pb}/api/servis`;
}

export function urlTiket() {
  if (import.meta.env.DEV) return "/api/tiket";
  const pb = (import.meta.env.PUBLIC_PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
  return `${pb}/api/tiket`;
}

/**
 * Kecilkan foto di browser sebelum upload (hemat kuota, muat server).
 * Skala sisi terpanjang ke `maksSisi` px, JPEG kualitas `kualitas`, kembalikan Blob.
 */
export async function kecilkanFoto(berkas: File, maksSisi = 1280, kualitas = 0.8): Promise<Blob> {
  const gambar = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Gagal membaca gambar"));
    img.src = URL.createObjectURL(berkas);
  });
  const skala = Math.min(1, maksSisi / Math.max(gambar.width, gambar.height));
  const w = Math.round(gambar.width * skala);
  const h = Math.round(gambar.height * skala);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return berkas;
  ctx.drawImage(gambar, 0, 0, w, h);
  URL.revokeObjectURL(gambar.src);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? berkas), "image/jpeg", kualitas));
}

export type PesananDibuatServis = { nomor: string; status: string };

export const MAKS_FOTO_SERVIS = 5;
export const TIPE_FOTO = ["image/jpeg", "image/png", "image/webp"];

export type IsianServis = {
  nama: string;
  wa: string;
  perangkat_jenis: string;
  perangkat: string;
  keluhan: string;
  cara_kirim: string;
  provinsi: string;
  jasa: string;
};

/** Field yang ditolak beserta pesannya (kunci sama dengan galat dari server). */
export function validasiServis(i: IsianServis): Record<string, string> {
  const g: Record<string, string> = {};
  const rapi = (v: string) => v.replace(/\s+/g, " ").trim();
  const nama = rapi(i.nama);
  const perangkat = rapi(i.perangkat);
  const keluhan = i.keluhan.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (nama.length < 2 || nama.length > 80) g.nama = "Nama 2–80 huruf.";
  if (!normalisasiWA(i.wa)) g.wa = "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.";
  if (!["mouse", "keyboard", "lainnya"].includes(i.perangkat_jenis)) g.perangkat_jenis = "Pilih jenis perangkat.";
  if (perangkat.length < 2 || perangkat.length > 80) g.perangkat = "Isi merek/tipe perangkat 2–80 huruf (mis. Logitech G102).";
  if (keluhan.length < 10 || keluhan.length > 1000) g.keluhan = "Ceritakan keluhannya 10–1000 huruf.";
  if (!["kurir", "antar"].includes(i.cara_kirim)) g.cara_kirim = "Pilih cara kirim perangkat.";
  if (i.cara_kirim === "kurir") {
    const prov = rapi(i.provinsi);
    if (!prov || prov.length > 60) g.provinsi = "Pilih provinsi untuk kirim balik.";
  }
  if (i.jasa && !/^[a-z0-9]{15}$/.test(i.jasa)) g.jasa = "Jenis servis tidak valid.";
  return g;
}

/** Periksa foto yang dipilih (sebelum dikecilkan). Hasil: pesan galat atau "". */
export function validasiPilihanFoto(berkas: { type: string }[]): string {
  if (berkas.length > MAKS_FOTO_SERVIS) return `Maksimal ${MAKS_FOTO_SERVIS} foto.`;
  if (berkas.some((b) => !TIPE_FOTO.includes(b.type))) return "Foto harus berupa gambar JPG, PNG, atau WebP.";
  return "";
}

export const LABEL_PERANGKAT: Record<string, string> = {
  mouse: "Mouse",
  keyboard: "Keyboard",
  lainnya: "Lainnya",
};

export const LABEL_CARA_KIRIM: Record<string, string> = {
  kurir: "Kirim lewat kurir",
  antar: "Antar langsung",
};
