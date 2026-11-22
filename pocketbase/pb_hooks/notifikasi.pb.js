/// <reference path="../pb_data/types.d.ts" />

// Notifikasi Telegram ke pemilik toko setelah pesanan atau tiket servis BERHASIL tersimpan.
// Berjalan setelah data tersimpan, dan telegram.js tidak pernah melempar galat,
// jadi kegagalan Telegram tidak menggagalkan pesanan/tiket.

onRecordAfterCreateSuccess((e) => {
  try {
    const T = require(`${__hooks}/telegram.js`);
    const r = e.record;
    let items = [];
    try { items = JSON.parse(r.getString("items") || "[]"); } catch (_) {}
    const berat = r.getInt("berat_gram");
    T.kirim(T.pesanPesanan({
      id: r.id,
      nomor: r.getString("nomor"),
      total: r.getInt("total"),
      jumlah_barang: items.reduce((n, it) => n + (it.jumlah || 0), 0),
      ongkir_konfirmasi: r.getBool("ongkir_konfirmasi"),
      alasan: r.getBool("ongkir_konfirmasi")
        ? (berat > 5000 ? "Berat " + (berat / 1000).toFixed(1).replace(".", ",") + " kg (di atas 5 kg)" : "Zona provinsi tidak ditemukan") + ": isi ongkir manual di panel admin."
        : "",
      provinsi: r.getString("provinsi"),
    }, $os.getenv("API_URL")));
  } catch (err) {
    e.app.logger().warn("Notifikasi pesanan gagal", "error", String(err));
  }
  e.next();
}, "pesanan");

onRecordAfterCreateSuccess((e) => {
  try {
    const T = require(`${__hooks}/telegram.js`);
    const r = e.record;
    let jasa = "";
    if (r.getString("jasa")) {
      try { jasa = e.app.findRecordById("jasa", r.getString("jasa")).getString("nama"); } catch (_) {}
    }
    T.kirim(T.pesanTiket({
      id: r.id,
      nomor: r.getString("nomor"),
      jasa: jasa,
      perangkat_jenis: r.getString("perangkat_jenis"),
      perangkat: r.getString("perangkat"),
      cara_kirim: r.getString("cara_kirim"),
    }, $os.getenv("API_URL")));
  } catch (err) {
    e.app.logger().warn("Notifikasi tiket gagal", "error", String(err));
  }
  e.next();
}, "tiket_servis");

// Ulasan baru (dari link khusus /api/ulasan) → beri tahu pemilik untuk menyetujui.
onRecordAfterCreateSuccess((e) => {
  try {
    const T = require(`${__hooks}/telegram.js`);
    const r = e.record;
    let komentar = "";
    try { komentar = String(r.getString("komentar") || "").replace(/\s+/g, " ").trim(); } catch (_) {}
    T.kirim(T.pesanUlasanBaru({
      id: r.id,
      jenis: r.getString("jenis"),
      bintang: r.getInt("bintang"),
      nama_tampil: r.getString("nama_tampil"),
      terverifikasi: r.getBool("terverifikasi"),
      ringkas: komentar.length > 120 ? komentar.slice(0, 117) + "…" : komentar,
    }, $os.getenv("API_URL")));
  } catch (err) {
    e.app.logger().warn("Notifikasi ulasan gagal", "error", String(err));
  }
  e.next();
}, "ulasan");
