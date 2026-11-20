// Pemicu ekspresi maskot dari bagian lain halaman (misalnya keranjang di tahap 3).
// Aman dipanggil walaupun tidak ada maskot di halaman.

export const EVENT_SENANG = "maskot:senang";

/** Semua maskot yang terlihat di halaman menampilkan ekspresi senang sebentar. */
export function maskotSenang() {
  window.dispatchEvent(new CustomEvent(EVENT_SENANG));
}
