/// <reference path="../pb_data/types.d.ts" />
// Skema awal Cupil Stuff (PocketBase v0.23+).
// Aturan akses: "" = publik, null = hanya superuser (admin).

const created = { name: "created", type: "autodate", onCreate: true, onUpdate: false };
const updated = { name: "updated", type: "autodate", onCreate: true, onUpdate: true };
const gambar = ["image/jpeg", "image/png", "image/webp"];
const MB = 1024 * 1024;

migrate((app) => {
  // ---------- kategori ----------
  const kategori = new Collection({
    type: "base",
    name: "kategori",
    listRule: "",
    viewRule: "",
    fields: [
      { name: "nama", type: "text", required: true, max: 80 },
      { name: "slug", type: "text", required: true, max: 80, pattern: "^[a-z0-9-]+$" },
      { name: "urutan", type: "number", onlyInt: true },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_kategori_slug ON kategori (slug)"],
  });
  app.save(kategori);
  // relasi ke diri sendiri (kategori induk) ditambahkan setelah id koleksi ada
  kategori.fields.add(new RelationField({ name: "induk", collectionId: kategori.id, maxSelect: 1 }));
  app.save(kategori);

  // ---------- produk ----------
  const produk = new Collection({
    type: "base",
    name: "produk",
    listRule: "aktif = true",
    viewRule: "aktif = true",
    fields: [
      { name: "kode", type: "text", required: true, max: 20, pattern: "^[A-Z]{3}-[0-9]{3,}$" },
      { name: "nama", type: "text", required: true, max: 120 },
      { name: "lini", type: "select", required: true, maxSelect: 1, values: ["model3d", "edc"] },
      { name: "kategori", type: "relation", collectionId: kategori.id, maxSelect: 1 },
      { name: "deskripsi", type: "editor" },
      { name: "foto", type: "file", maxSelect: 10, maxSize: 5 * MB, mimeTypes: gambar },
      { name: "model_3d", type: "file", maxSelect: 1, maxSize: 20 * MB, mimeTypes: ["model/gltf-binary", "application/octet-stream"] },
      // [{ "nama": "Merah", "hex": "#e53935" }]; hex null = warna asli model
      { name: "warna", type: "json" },
      // nama material yang ikut berubah warna; kosong = semua bagian
      { name: "bagian_warna", type: "json" },
      { name: "link_marketplace", type: "url" },
      { name: "aktif", type: "bool" },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_produk_kode ON produk (kode)"],
  });
  app.save(produk);

  // ---------- varian ----------
  const varian = new Collection({
    type: "base",
    name: "varian",
    listRule: "produk.aktif = true",
    viewRule: "produk.aktif = true",
    fields: [
      { name: "produk", type: "relation", required: true, collectionId: produk.id, maxSelect: 1, cascadeDelete: true },
      // boleh dikosongkan: diisi otomatis oleh hook (lihat pb_hooks/main.pb.js)
      { name: "kode", type: "text", max: 30 },
      { name: "nama", type: "text", required: true, max: 80 },
      { name: "harga", type: "number", required: true, min: 0, onlyInt: true },
      // gram; berat barang + packing, atau berat volume (p x l x t / 6000 x 1000) jika lebih besar
      { name: "berat_kirim", type: "number", required: true, min: 1, onlyInt: true },
      { name: "stok", type: "number", min: 0, onlyInt: true },
      { name: "preorder", type: "bool" },
      { name: "foto", type: "file", maxSelect: 5, maxSize: 5 * MB, mimeTypes: gambar },
      { name: "urutan", type: "number", onlyInt: true },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_varian_kode ON varian (kode)"],
  });
  app.save(varian);

  // ---------- zona_ongkir ----------
  const zona = new Collection({
    type: "base",
    name: "zona_ongkir",
    listRule: "",
    viewRule: "",
    fields: [
      { name: "nama", type: "text", required: true },
      { name: "provinsi", type: "json", required: true },
      { name: "tarif_per_kg", type: "number", required: true, min: 0, onlyInt: true },
      { name: "estimasi", type: "text" },
      { name: "urutan", type: "number", onlyInt: true },
      created,
      updated,
    ],
  });
  app.save(zona);

  // ---------- pesanan (dipakai mulai tahap 3) ----------
  const pesanan = new Collection({
    type: "base",
    name: "pesanan",
    listRule: null,
    viewRule: null,
    createRule: null, // dibuka di tahap 3 lewat route khusus yang menghitung total di server
    fields: [
      { name: "nomor", type: "text" },
      { name: "items", type: "json", required: true },
      { name: "pembeli", type: "text", required: true },
      { name: "wa", type: "text", required: true },
      { name: "alamat", type: "text", required: true },
      { name: "provinsi", type: "text", required: true },
      { name: "zona", type: "relation", collectionId: zona.id, maxSelect: 1 },
      { name: "berat_ditagih_kg", type: "number", onlyInt: true },
      { name: "subtotal", type: "number", onlyInt: true },
      { name: "ongkir", type: "number", onlyInt: true },
      { name: "potongan_ongkir", type: "number", onlyInt: true },
      { name: "total", type: "number", onlyInt: true },
      { name: "status_bayar", type: "select", maxSelect: 1, values: ["menunggu", "lunas", "batal"] },
      { name: "status_kirim", type: "select", maxSelect: 1, values: ["diproses", "dikirim", "selesai"] },
      { name: "resi", type: "text" },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_pesanan_nomor ON pesanan (nomor)"],
  });
  app.save(pesanan);

  // ---------- jasa ----------
  const jasa = new Collection({
    type: "base",
    name: "jasa",
    listRule: "aktif = true",
    viewRule: "aktif = true",
    fields: [
      { name: "kode", type: "text", required: true, pattern: "^SRV-[0-9]{3,}$" },
      { name: "nama", type: "text", required: true },
      { name: "perangkat", type: "select", maxSelect: 1, values: ["mouse", "keyboard", "lainnya"] },
      { name: "deskripsi", type: "editor" },
      { name: "harga_mulai", type: "number", min: 0, onlyInt: true },
      { name: "estimasi", type: "text" },
      { name: "aktif", type: "bool" },
      { name: "urutan", type: "number", onlyInt: true },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_jasa_kode ON jasa (kode)"],
  });
  app.save(jasa);

  // ---------- tiket_servis (dipakai mulai tahap 4) ----------
  const tiket = new Collection({
    type: "base",
    name: "tiket_servis",
    listRule: null,
    viewRule: null,
    createRule: null, // dibuka di tahap 4 lewat route khusus
    fields: [
      { name: "nomor", type: "text" },
      { name: "jasa", type: "relation", collectionId: jasa.id, maxSelect: 1 },
      { name: "nama", type: "text", required: true },
      { name: "wa", type: "text", required: true },
      { name: "perangkat", type: "text", required: true },
      { name: "keluhan", type: "text", required: true },
      { name: "foto", type: "file", maxSelect: 5, maxSize: 5 * MB, mimeTypes: gambar },
      { name: "cara_kirim", type: "select", maxSelect: 1, values: ["kurir", "antar"] },
      { name: "estimasi_biaya", type: "number", onlyInt: true },
      { name: "biaya_final", type: "number", onlyInt: true },
      {
        name: "status",
        type: "select",
        maxSelect: 1,
        values: ["menunggu_perangkat", "diterima", "dicek", "menunggu_persetujuan", "dikerjakan", "selesai", "dikirim", "dikembalikan"],
      },
      created,
      updated,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_tiket_nomor ON tiket_servis (nomor)"],
  });
  app.save(tiket);

  // ---------- portofolio ----------
  const portofolio = new Collection({
    type: "base",
    name: "portofolio",
    listRule: "",
    viewRule: "",
    fields: [
      { name: "judul", type: "text", required: true },
      { name: "foto_sebelum", type: "file", maxSelect: 1, maxSize: 5 * MB, mimeTypes: gambar },
      { name: "foto_sesudah", type: "file", maxSelect: 1, maxSize: 5 * MB, mimeTypes: gambar },
      { name: "keterangan", type: "text" },
      { name: "urutan", type: "number", onlyInt: true },
      created,
      updated,
    ],
  });
  app.save(portofolio);

  // ---------- data awal: 6 zona ongkir (J&T EZ dari Surabaya) ----------
  const zonaAwal = [
    ["Dalam kota Surabaya", ["Kota Surabaya"], 8000, "1 hari"],
    ["Jawa", ["DKI Jakarta", "Jawa Barat", "Banten", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur"], 20000, "2–3 hari"],
    ["Bali, NTB, Kalimantan, Sulawesi", [
      "Bali", "Nusa Tenggara Barat",
      "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara",
      "Sulawesi Utara", "Gorontalo", "Sulawesi Tengah", "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tenggara",
    ], 35000, "3–5 hari"],
    ["Sumatra", [
      "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau", "Jambi",
      "Sumatera Selatan", "Kepulauan Bangka Belitung", "Bengkulu", "Lampung",
    ], 50000, "3–7 hari"],
    ["NTT dan Maluku", ["Nusa Tenggara Timur", "Maluku", "Maluku Utara"], 75000, "5–7 hari"],
    ["Papua", ["Papua", "Papua Barat", "Papua Barat Daya", "Papua Tengah", "Papua Pegunungan", "Papua Selatan"], 100000, "5–10 hari"],
  ];
  zonaAwal.forEach(([nama, provinsi, tarif, estimasi], i) => {
    const r = new Record(zona);
    r.set("nama", nama);
    r.set("provinsi", provinsi);
    r.set("tarif_per_kg", tarif);
    r.set("estimasi", estimasi);
    r.set("urutan", i + 1);
    app.save(r);
  });
}, (app) => {
  // rollback: hapus koleksi dalam urutan kebalikan relasi
  ["portofolio", "tiket_servis", "jasa", "pesanan", "zona_ongkir", "varian", "produk", "kategori"].forEach((nama) => {
    try {
      app.delete(app.findCollectionByNameOrId(nama));
    } catch (_) {}
  });
});
