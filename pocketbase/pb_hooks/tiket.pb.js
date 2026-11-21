/// <reference path="../pb_data/types.d.ts" />

// GET /api/tiket/{nomor}?wa=XXXX
// Pembeli memasukkan nomor tiket + 4 digit terakhir WA → hanya status, nama jasa, perangkat,
// biaya, ongkir kirim balik, tagihan, dan tanggal. Tanpa nama, WA, keluhan, foto, atau provinsi.

routerAdd("GET", "/api/tiket/{nomor}", (e) => {
  const W = require(`${__hooks}/cekwa.js`);
  const S = require(`${__hooks}/servis.js`);

  const path = e.request.url.path;
  const bagian = path.split("/");
  const nomor = decodeURIComponent(bagian[bagian.length - 1]);

  const wa4 = W.ambilWA4(e);

  // IP yang sedang diblokir ditolak sebelum mencari tiket
  const blokir = W.cekBlokir(e, "tiket");
  if (blokir) return e.json(blokir.status, blokir.body);

  let tk;
  try {
    tk = e.app.findFirstRecordByData("tiket_servis", "nomor", nomor);
  } catch (_) {
    W.gagal(e, "tiket"); // menebak nomor tiket juga dihitung sebagai percobaan gagal
    return e.json(404, { pesan: "Tiket tidak ditemukan." });
  }

  const tolak = W.cekWA(e, tk, wa4, "tiket");
  if (tolak) return e.json(tolak.status, tolak.body);

  // nama jasa (jika ada)
  let namaJasa = null;
  const jasaId = tk.getString("jasa");
  if (jasaId) {
    try {
      namaJasa = e.app.findRecordById("jasa", jasaId).getString("nama");
    } catch (_) {}
  }

  // hanya field yang diizinkan (lihat responsPublik di servis.js)
  return e.json(200, S.responsPublik({
    nomor: tk.getString("nomor"),
    status: tk.getString("status"),
    status_bayar: tk.getString("status_bayar"),
    perangkat: tk.getString("perangkat"),
    cara_kirim: tk.getString("cara_kirim"),
    estimasi_biaya: tk.getInt("estimasi_biaya"),
    biaya_final: tk.getInt("biaya_final"),
    ongkir_kirim_balik: tk.getInt("ongkir_kirim_balik"),
    created: tk.getString("created"),
    updated: tk.getString("updated"),
  }, namaJasa));
});