/// <reference path="../pb_data/types.d.ts" />
// Ulasan pembeli (tahap 8).
// - ulasan: ulasan produk/servis. Publik (listRule/viewRule) HANYA melihat status = "tampil";
//   field relasi pesanan/tiket asal, token, dan data pribadi tidak pernah dikembalikan ke publik
//   (lihat responsPublik / hook yang menyaring field). createRule = null: ulasan hanya dibuat
//   lewat route POST /api/ulasan (dari link khusus, terverifikasi) atau oleh pemilik di panel admin.
// - pesanan & tiket_servis: token ulasan sekali pakai (berlaku 30 hari) + link_wa_ulasan (URL
//   wa.me terisi otomatis oleh hook, dipakai pemilik untuk meminta ulasan).

const MB = 1024 * 1024;
const gambar = ["image/jpeg", "image/png", "image/webp"];

migrate((app) => {
  // ---------- ulasan ----------
  const ulasan = new Collection({
    type: "base",
    name: "ulasan",
    // publik hanya melihat ulasan yang tampil, dan hanya field tampilan (tanpa relasi
    // pesanan/tiket asal, token, dan data pribadi). Lihat responsPublik di pb_hooks/ulasan.js.
    listRule: "status = 'tampil'",
    viewRule: "status = 'tampil'",
    createRule: null, // hanya route /api/ulasan atau panel admin
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "jenis", type: "select", required: true, maxSelect: 1, values: ["produk", "servis"] },
      { name: "produk", type: "relation", collectionId: app.findCollectionByNameOrId("produk").id, maxSelect: 1 },
      { name: "jasa", type: "relation", collectionId: app.findCollectionByNameOrId("jasa").id, maxSelect: 1 },
      { name: "pesanan", type: "relation", collectionId: app.findCollectionByNameOrId("pesanan").id, maxSelect: 1 },
      { name: "tiket", type: "relation", collectionId: app.findCollectionByNameOrId("tiket_servis").id, maxSelect: 1 },
      { name: "bintang", type: "number", required: true, min: 1, max: 5, onlyInt: true },
      { name: "komentar", type: "text", max: 500 },
      { name: "foto", type: "file", maxSelect: 3, maxSize: 5 * MB, mimeTypes: gambar },
      { name: "nama_tampil", type: "text", max: 60 },
      { name: "sumber", type: "select", maxSelect: 1, values: ["situs", "whatsapp", "marketplace", "lainnya"] },
      { name: "terverifikasi", type: "bool" }, // hanya true bila dari link khusus (token)
      { name: "token", type: "text" }, // token link ulasan (pesanan/tiket) yang dipakai; untuk cek sekali pakai
      { name: "status", type: "select", maxSelect: 1, values: ["menunggu", "tampil", "disembunyikan"] },
      { name: "izin_tampil", type: "bool" }, // pembeli mengizinkan ulasannya ditampilkan
      { name: "unggulan", type: "bool" }, // tampil di bagian "Kata pembeli" landing page
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_ulasan_status ON ulasan (status)",
      "CREATE INDEX idx_ulasan_jenis ON ulasan (jenis)",
      "CREATE INDEX idx_ulasan_produk ON ulasan (produk)",
      "CREATE INDEX idx_ulasan_jasa ON ulasan (jasa)",
    ],
  });
  app.save(ulasan);

  // ---------- pesanan: token ulasan + link_wa_ulasan ----------
  const pesanan = app.findCollectionByNameOrId("pesanan");
  pesanan.fields.add(new TextField({ name: "token_ulasan" }));
  pesanan.fields.add(new TextField({ name: "link_wa_ulasan" }));
  app.save(pesanan);

  // ---------- tiket_servis: token ulasan + link_wa_ulasan ----------
  const tiket = app.findCollectionByNameOrId("tiket_servis");
  tiket.fields.add(new TextField({ name: "token_ulasan" }));
  tiket.fields.add(new TextField({ name: "link_wa_ulasan" }));
  app.save(tiket);
}, (app) => {
  const pesanan = app.findCollectionByNameOrId("pesanan");
  pesanan.fields.removeByName("token_ulasan");
  pesanan.fields.removeByName("link_wa_ulasan");
  app.save(pesanan);

  const tiket = app.findCollectionByNameOrId("tiket_servis");
  tiket.fields.removeByName("token_ulasan");
  tiket.fields.removeByName("link_wa_ulasan");
  app.save(tiket);

  try {
    app.delete(app.findCollectionByNameOrId("ulasan"));
  } catch (_) {}
});