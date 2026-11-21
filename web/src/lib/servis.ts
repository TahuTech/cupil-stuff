// Helper form servis di browser: alamat route, pengecilan foto sebelum upload,
// dan tipe balasan. Validasi utama tetap di server (pb_hooks/servis.js).

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

export const LABEL_PERANGKAT: Record<string, string> = {
  mouse: "Mouse",
  keyboard: "Keyboard",
  lainnya: "Lainnya",
};

export const LABEL_CARA_KIRIM: Record<string, string> = {
  kurir: "Kirim lewat kurir",
  antar: "Antar langsung",
};
