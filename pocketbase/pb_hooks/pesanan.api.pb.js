/// <reference path="../pb_data/types.d.ts" />

// GET /api/pesanan/{nomor}?wa=XXXX
// Pembeli memasukkan 4 digit terakhir WA → data pesanan TANPA info pribadi
// (tanpa alamat, nama pembeli, nomor WA lengkap).

routerAdd("GET", "/api/pesanan/{nomor}", (e) => {
  const W = require(`${__hooks}/cekwa.js`);

  // nomor dari path (param {nomor} tidak dibaca lewat pathParams di pb 0.40)
  const path = e.request.url.path;
  const bagian = path.split("/");
  const nomor = decodeURIComponent(bagian[bagian.length - 1]);

  const wa4 = W.ambilWA4(e);

  // IP yang sedang diblokir ditolak sebelum mencari pesanan
  const blokir = W.cekBlokir(e, "bayar");
  if (blokir) return e.json(blokir.status, blokir.body);

  let ps;
  try {
    ps = e.app.findFirstRecordByData("pesanan", "nomor", nomor);
  } catch (_) {
    W.gagal(e, "bayar"); // menebak nomor pesanan juga dihitung sebagai percobaan gagal
    return e.json(404, { pesan: "Pesanan tidak ditemukan." });
  }

  const tolak = W.cekWA(e, ps, wa4, "bayar");
  if (tolak) return e.json(tolak.status, tolak.body);

  let items = [];
  try { items = JSON.parse(ps.getString("items")) || []; } catch (_) {}

  let zonaInfo = null;
  const zonaId = ps.getString("zona");
  if (zonaId) {
    try {
      const z = e.app.findRecordById("zona_ongkir", zonaId);
      zonaInfo = { nama: z.getString("nama"), estimasi: z.getString("estimasi") };
    } catch (_) {}
  }

  return e.json(200, {
    nomor: ps.getString("nomor"),
    status_bayar: ps.getString("status_bayar"),
    status_kirim: ps.getString("status_kirim"),
    items: (Array.isArray(items) ? items : []).map(function (it) {
      return {
        kode: it.kode, nama: it.nama, varian_nama: it.varian_nama,
        warna: it.warna, harga: it.harga, jumlah: it.jumlah, subtotal: it.subtotal,
      };
    }),
    berat_ditagih_kg: ps.getInt("berat_ditagih_kg"),
    ongkir: ps.getInt("ongkir"),
    potongan_ongkir: ps.getInt("potongan_ongkir"),
    total: ps.getInt("total"),
    ongkir_konfirmasi: ps.getBool("ongkir_konfirmasi"),
    zona: zonaInfo,
    resi: ps.getString("resi") || null,
  });
});

