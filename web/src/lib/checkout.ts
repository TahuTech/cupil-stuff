// Checkout dari browser: validasi isian (aturan sama dengan pocketbase/pb_hooks/pesanan.js,
// dijaga oleh checkout.test.ts) dan alamat route /api/checkout.
// Validasi di sini hanya untuk kenyamanan; server tetap memeriksa ulang semuanya.

import { urlApi } from "./api";

export type IsianCheckout = { nama: string; wa: string; alamat: string; provinsi: string };

export function normalisasiWA(v: string): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return /^628\d{7,11}$/.test(d) ? d : null;
}

export function validasiIsian(i: IsianCheckout): Partial<Record<keyof IsianCheckout, string>> {
  const galat: Partial<Record<keyof IsianCheckout, string>> = {};
  const nama = i.nama.replace(/\s+/g, " ").trim();
  const alamat = i.alamat.replace(/[ \t]+/g, " ").trim();
  if (nama.length < 2 || nama.length > 80) galat.nama = "Nama 2–80 huruf.";
  if (!normalisasiWA(i.wa)) galat.wa = "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.";
  if (alamat.length < 10 || alamat.length > 500) galat.alamat = "Alamat lengkap 10–500 huruf.";
  if (!i.provinsi) galat.provinsi = "Pilih provinsi tujuan.";
  return galat;
}

export const urlCheckout = () => urlApi("/api/checkout");

/** Balasan sukses dari /api/checkout (angka dari server). */
export type PesananDibuat = {
  nomor: string;
  items: { kode: string; nama: string; varian_nama: string; warna: string | null; harga: number; jumlah: number; subtotal: number }[];
  subtotal: number;
  berat_ditagih_kg: number;
  ongkir: number;
  potongan_ongkir: number;
  total: number;
  ongkir_konfirmasi: boolean;
  alasan_konfirmasi: string;
  zona: { nama: string; estimasi: string } | null;
  provinsi: string;
};

export const KUNCI_PESANAN = "cupil:pesanan-terakhir";
