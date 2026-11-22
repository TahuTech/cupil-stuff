// Pengaturan toko yang jarang berubah.
// Sebelum go-live, cari "TODO(go-live)" di file ini dan ganti nilai contohnya.
export const TOKO = {
  nama: "Cupil Stuff",
  tagline: "Model 3D buatan sendiri, barang EDC, dan servis mouse & keyboard mechanical",
  kota: "Surabaya",
  // Berdiri dan aktif berjualan sejak bulan/tahun ini (tampil di footer & halaman tentang).
  berdiriSejak: "Februari 2020",
  jamOperasional: "Senin–Sabtu, 09.00–20.00 WIB",
  // TODO(go-live): nomor WhatsApp toko, format internasional: 62 lalu nomor tanpa 0 di depan
  nomorWA: "6281234567890",
  // TODO(go-live): toko di marketplace, tampil di footer. Biarkan kosong jika belum ada.
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
  // TODO(go-live): alamat lengkap untuk mengirim perangkat servis lewat kurir
  // (tampil di halaman sukses tiket bila cara kirim = kurir).
  alamatKirim: "Cupil Stuff — Jl. Contoh No. 1, Surabaya, Jawa Timur 60123",
  // TODO(go-live): info antar dan ambil langsung (tampil di aturan servis dan di halaman sukses
  // bila cara kirim = antar). Sebutkan lokasi umum atau jam, tanpa alamat rumah jika tidak ingin publik.
  infoAntar: "Antar dan ambil langsung di Surabaya tanpa ongkir. Kabari dulu lewat WhatsApp untuk atur jam dan lokasi.",
};
