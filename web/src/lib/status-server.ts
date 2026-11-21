// Deteksi apakah server (PocketBase di homelab) bisa dihubungi.
// Katalog statis tetap jalan tanpa server; yang dialihkan hanya fitur yang butuh server
// (checkout, servis, cek tiket, cek pesanan) → jatuh ke WhatsApp.

import { urlApi } from "./api";

/** Hasil pengecekan: "hidup", "mati", atau "belum tahu" (belum pernah dicek). */
export type StatusServer = "hidup" | "mati" | "belum-tahu";

const TIMEOUT_MS = 3000;
const SIMPAN_MS = 60_000; // hasil disimpan 60 detik supaya tidak mengecek berulang

let hasilTerakhir: { status: StatusServer; waktu: number } = { status: "belum-tahu", waktu: 0 };

/** true bila request ke server gagal karena jaringan/timeout/5xx (server dianggap mati). */
export function gagalKarenaServer(status: number | null): boolean {
  // null = tidak ada respons (jaringan / timeout)
  if (status === null) return true;
  return status >= 500;
}

/** Catat bahwa server mati (dipanggil saat checkout/servis/tiket gagal karena jaringan/5xx). */
export function tandaiServerMati() {
  hasilTerakhir = { status: "mati", waktu: Date.now() };
}

/** Catat bahwa server hidup (dipanggil saat sebuah request berhasil). */
export function tandaiServerHidup() {
  hasilTerakhir = { status: "hidup", waktu: Date.now() };
}

function masihBerlaku() {
  return Date.now() - hasilTerakhir.waktu < SIMPAN_MS;
}

/**
 * Cek status server. Memakai hasil tersimpan bila masih dalam 60 detik.
 * `paksa` = true melewati cache (dipakai tombol "coba lagi").
 */
export async function cekServer(paksa = false): Promise<StatusServer> {
  if (!paksa && masihBerlaku() && hasilTerakhir.status !== "belum-tahu") return hasilTerakhir.status;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let status: StatusServer;
  try {
    const res = await fetch(urlApi("/api/health"), { signal: ctrl.signal, cache: "no-store" });
    status = res.ok ? "hidup" : gagalKarenaServer(res.status) ? "mati" : "hidup";
  } catch {
    status = "mati"; // jaringan mati / timeout / abort
  } finally {
    clearTimeout(timer);
  }
  hasilTerakhir = { status, waktu: Date.now() };
  return status;
}

/**
 * Bungkus fetch ke route yang butuh server. Bila gagal karena jaringan/timeout/5xx,
 * tandai server mati supaya halaman lain ikut beralih ke WhatsApp.
 * Bila berhasil, tandai hidup. Error 4xx/429 DAN galat validasi TIDAK ditandai mati.
 */
export async function fetchServer(input: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    tandaiServerMati();
    throw err;
  }
  if (gagalKarenaServer(res.status)) tandaiServerMati();
  else tandaiServerHidup();
  return res;
}

/** Tampilkan/sembunyikan banner #banner-server (dipakai halaman yang terdampak). */
export function aturBannerServer(mati: boolean) {
  const el = document.getElementById("banner-server");
  if (el) el.hidden = !mati;
}

/**
 * Jalankan deteksi awal saat halaman dimuat: cek server lalu atur banner.
 * Mengembalikan status. Bila server hidup lagi, halaman cukup memanggil ulang fungsi ini
 * (mis. tombol "coba lagi") — tidak perlu reload.
 */
export async function deteksiAwal(paksa = false): Promise<StatusServer> {
  const status = await cekServer(paksa);
  aturBannerServer(status === "mati");
  return status;
}

export const JEDA_PANTAU_MS = 15_000;

/**
 * Pantau server untuk sebuah halaman: cek saat dimuat, saat tab aktif lagi, dan — selama
 * server mati — setiap 15 detik (tanpa memakai hasil tersimpan), supaya halaman kembali normal
 * begitu server hidup lagi tanpa reload. `saatUbah` dipanggil dengan true bila mati.
 */
export function pantauServer(saatUbah: (mati: boolean) => void) {
  const terapkan = (status: StatusServer) => saatUbah(status === "mati");
  deteksiAwal().then(terapkan);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) deteksiAwal(hasilTerakhir.status === "mati").then(terapkan);
  });
  setInterval(() => {
    if (hasilTerakhir.status === "mati" && !document.hidden) deteksiAwal(true).then(terapkan);
  }, JEDA_PANTAU_MS);
}
