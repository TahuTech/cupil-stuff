/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Route: GET /api/pesanan/{nomor}?wa=XXXX
// Pembeli memasukkan 4 digit terakhir WA → mengembalikan data tanpa info pribadi.
// Batasi percobaan: 4 digit salah 5× dari IP sama ditolak 15 menit.
// =============================================================================

routerAdd("GET", "/api/pesanan/{nomor}", (e) => {
  // Ambil nomor dari path: /api/pesanan/CS-XXXX
  var path = e.request.url.path;
  var bagian = path.split("/");
  var nomor = bagian[bagian.length - 1];

  // Ambil wa dari query string manual
  var rawQuery = e.request.url.rawQuery || "";
  var match = rawQuery.match(/wa=(\d{4})/);
  var wa4 = match ? match[1] : "";
  if (!/^\d{4}$/.test(wa4)) return e.json(400, { pesan: "Masukkan 4 digit terakhir WA." });

  // Rate limit: gunakan remoteAddr sebagai kunci
  var ip = e.request.remoteAddr || "0.0.0.0";
  var kunci = "bayar:blok:" + ip;
  var blokir = JSON.parse($app.store().get(kunci) || "{}");

  if (blokir.sampai && Date.now() < blokir.sampai) {
    var sisa = Math.ceil((blokir.sampai - Date.now()) / 60000);
    return e.json(429, { pesan: "Terlalu banyak percobaan. Coba lagi " + sisa + " menit." });
  }

  // Cari pesanan
  var ps;
  try { ps = e.app.findFirstRecordByData("pesanan", "nomor", nomor); } catch (_) {
    return e.json(404, { pesan: "Pesanan tidak ditemukan." });
  }

  // Cek 4 digit WA
  var wa = ps.getString("wa").replace(/\D/g, "");
  if (wa.length < 4 || wa.slice(-4) !== wa4) {
    var gagal = (blokir.gagal || 0) + 1;
    $app.store().set(kunci, JSON.stringify({
      gagal: gagal,
      sampai: gagal >= 5 ? Date.now() + 15 * 60 * 1000 : 0,
    }));
    return e.json(403, { pesan: "4 digit terakhir tidak cocok." });
  }
  $app.store().remove(kunci);

  // Data aman (tanpa alamat, nama, WA lengkap)
  var items;
  try { items = JSON.parse(ps.getString("items")); } catch (_) { items = []; }

  var zonaInfo = null;
  var zonaId = ps.getString("zona");
  if (zonaId) {
    try {
      var z = e.app.findRecordById("zona_ongkir", zonaId);
      zonaInfo = { nama: z.getString("nama"), estimasi: z.getString("estimasi") };
    } catch (_) {}
  }

  return e.json(200, {
    nomor: ps.getString("nomor"),
    status_bayar: ps.getString("status_bayar"),
    status_kirim: ps.getString("status_kirim"),
    items: Array.isArray(items) ? items.map(function (it) {
      return {
        kode: it.kode, nama: it.nama, varian_nama: it.varian_nama,
        warna: it.warna, harga: it.harga, jumlah: it.jumlah, subtotal: it.subtotal,
      };
    }) : [],
    berat_ditagih_kg: ps.getInt("berat_ditagih_kg"),
    ongkir: ps.getInt("ongkir"),
    potongan_ongkir: ps.getInt("potongan_ongkir"),
    total: ps.getInt("total"),
    ongkir_konfirmasi: ps.getBool("ongkir_konfirmasi"),
    zona: zonaInfo,
    resi: ps.getString("resi") || null,
  });
});