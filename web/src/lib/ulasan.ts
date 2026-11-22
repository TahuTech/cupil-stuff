// Helper ulasan di browser: validasi isian (aturan sama dengan pocketbase/pb_hooks/ulasan.js,
// dijaga oleh ulasan.test.ts), alamat route, label sumber, dan tipe balasan.
// Validasi di sini hanya untuk kenyamanan; server tetap memeriksa ulang semuanya.

import { urlApi } from "./api";

export const urlUlasan = () => urlApi("/api/ulasan");

export const MAKS_FOTO_ULASAN = 3;
export const TIPE_FOTO_ULASAN = ["image/jpeg", "image/png", "image/webp"];
export const MAKS_KOMENTAR_ULASAN = 500;
export const MAKS_NAMA_ULASAN = 60;

export type IsianUlasan = {
  bintang: number;
  komentar: string;
  nama_tampil: string;
  izin_tampil: boolean;
};

/** Field yang ditolak beserta pesannya (kunci sama dengan galat dari server). */
export function validasiUlasan(i: IsianUlasan): Record<string, string> {
  const g: Record<string, string> = {};
  if (!Number.isInteger(i.bintang) || i.bintang < 1 || i.bintang > 5) g.bintang = "Pilih 1–5 bintang.";
  const komentar = i.komentar.trim();
  if (komentar.length > MAKS_KOMENTAR_ULASAN) g.komentar = "Ulasan maksimal 500 huruf.";
  const nama = i.nama_tampil.trim();
  if (nama.length > MAKS_NAMA_ULASAN) g.nama_tampil = "Nama tampil maksimal 60 huruf.";
  return g;
}

/** Periksa foto yang dipilih (sebelum dikecilkan). Hasil: pesan galat atau "". */
export function validasiPilihanFotoUlasan(berkas: { type: string }[]): string {
  if (berkas.length > MAKS_FOTO_ULASAN) return `Maksimal ${MAKS_FOTO_ULASAN} foto.`;
  if (berkas.some((b) => !TIPE_FOTO_ULASAN.includes(b.type))) return "Foto harus berupa gambar JPG, PNG, atau WebP.";
  return "";
}

// ---------- label sumber (sama dengan ulasan.js labelSumber) ----------

/** Label sumber untuk kartu ulasan. "Pembeli terverifikasi" hanya jika terverifikasi. */
export function labelSumber(terverifikasi: boolean, sumber: string): string {
  if (terverifikasi) return "Pembeli terverifikasi";
  switch (sumber) {
    case "whatsapp":
      return "via WhatsApp";
    case "marketplace":
      return "dari marketplace";
    case "situs":
      return "Pembeli terverifikasi";
    default:
      return "dari pelanggan";
  }
}

/** Tanda bintang untuk rating: kembalikan "★★★★☆" sesuai nilai 1–5. */
export function bintangTeks(n: number): string {
  const penuh = Math.max(0, Math.min(5, Math.round(n)));
  return "★★★★★".slice(0, penuh) + "☆☆☆☆☆".slice(0, 5 - penuh);
}

export type UlasanDibuat = { ok: boolean; pesan: string };