// Menerapkan pesanan.wa.js ke record pesanan (dipanggil pesanan.wa.pb.js).
function isi(r) {
  const W = require(__hooks + "/pesanan.wa.js");
  const B = require(__hooks + "/bersama.js");

  const ubah = W.ongkirManual({
    ongkir_konfirmasi: r.getBool("ongkir_konfirmasi"),
    ongkir: r.getInt("ongkir"),
    subtotal: r.getInt("subtotal"),
  });
  if (ubah) for (const k in ubah) r.set(k, ubah[k]);

  const link = W.linkWA({
    nomor: r.getString("nomor"),
    pembeli: r.getString("pembeli"),
    wa: r.getString("wa"),
    total: r.getInt("total"),
    ongkir_konfirmasi: r.getBool("ongkir_konfirmasi"),
    status_bayar: r.getString("status_bayar"),
    resi: r.getString("resi"),
  }, { toko: "Cupil Stuff", situs: B.situsDariEnv() });
  for (const k in link) r.set(k, link[k]);
}

module.exports = { isi };
