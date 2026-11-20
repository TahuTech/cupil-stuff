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
