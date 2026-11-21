// Pengaturan toko yang jarang berubah.
export const TOKO = {
  nama: "Cupil Stuff",
  tagline: "Model 3D buatan sendiri, barang EDC, dan servis mouse & keyboard mechanical",
  kota: "Surabaya",
  // Nomor WhatsApp format internasional: 62 lalu nomor tanpa 0 di depan
  nomorWA: "6281234567890",
  // Toko di marketplace, tampil di footer. Kosongkan jika belum ada.
  // Contoh: { nama: "Tokopedia", url: "https://www.tokopedia.com/namatoko" }
  marketplace: [] as { nama: string; url: string }[],
};

export const linkWA = (pesan?: string) =>
  `https://wa.me/${TOKO.nomorWA}${pesan ? `?text=${encodeURIComponent(pesan)}` : ""}`;

export const LINI: Record<string, string> = {
  model3d: "Model 3D",
  edc: "EDC",
};

// ---------- Jasa servis ----------
// Berat bawaan perangkat untuk ongkir kirim balik ada di server: pocketbase/pb_hooks/servis.js
// (BERAT_PERANGKAT), karena semua angka tagihan dihitung di server.
export const SERVIS = {
  // Alamat untuk mengirim perangkat (ditampilkan di halaman sukses bila cara kirim = kurir).
  alamatKirim: "Cupil Stuff — Jl. Contoh No. 1, Surabaya, Jawa Timur 60123 (isi alamat lengkap toko di web/src/config.ts)",
  // Info antar dan ambil langsung (ditampilkan di aturan dan di halaman sukses bila cara kirim = antar).
  infoAntar: "Antar dan ambil langsung di Surabaya tanpa ongkir. Kabari dulu lewat WhatsApp untuk atur jam dan lokasi.",
};
