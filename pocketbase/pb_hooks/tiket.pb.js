/// <reference path="../pb_data/types.d.ts" />

// GET /api/tiket/{nomor}?wa=XXXX
// Pembeli memasukkan nomor tiket + 4 digit terakhir WA → hanya status, jasa,
// estimasi biaya, dan tanggal (tanpa data pribadi lain).

routerAdd("GET", "/api/tiket/{nomor}", (e) => {
  const W = require(`${__hooks}/cekwa.js`);
  const S = require(`${__hooks}/servis.js`);

  const path = e.request.url.path;
  const bagian = path.split("/");
  const nomor = decodeURIComponent(bagian[bagian.length - 1]);

  const wa4 = W.ambilWA4(e);

  let tk;
  try {
    tk = e.app.findFirstRecordByData("tiket_servis", "nomor", nomor);
  } catch (_) {
    return e.json(404, { pesan: "Tiket tidak ditemukan." });
  }

  const tolak = W.cekWA(e, tk, wa4, "tiket");
  if (tolak) return e.json(tolak.status, tolak.body);

  // nama jasa (jika ada)
  let jasa = null;
  const jasaId = tk.getString("jasa");
  if (jasaId) {
    try {
      const rj = e.app.findRecordById("jasa", jasaId);
      jasa = { kode: rj.getString("kode"), nama: rj.getString("nama") };
    } catch (_) {}
  }

  const status = tk.getString("status") || "menunggu_perangkat";

  return e.json(200, {
    nomor: tk.getString("nomor"),
    status: status,
    status_label: S.LABEL_STATUS[status] || status,
    jasa: jasa,
    perangkat: tk.getString("perangkat"),
    cara_kirim: tk.getString("cara_kirim"),
    estimasi_biaya: tk.getInt("estimasi_biaya") || null,
    biaya_final: tk.getInt("biaya_final") || null,
    ongkir_kirim_balik: tk.getInt("ongkir_kirim_balik") || null,
    dibuat: tk.getString("created"),
    diperbarui: tk.getString("updated"),
  });
});