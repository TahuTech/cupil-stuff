// Menerapkan pesanan.wa.js + ulasan.wa.js ke record pesanan (dipanggil pesanan.wa.pb.js).
function isi(r) {
  const W = require(__hooks + "/pesanan.wa.js");
  const U = require(__hooks + "/ulasan.wa.js");
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

  // token ulasan: dibuat otomatis saat pesanan layak (status_kirim dikirim/selesai)
  // dan belum punya token; token kedaluwarsa (30 hari) membuat tautan tidak diperpanjang.
  const statusKirim = r.getString("status_kirim");
  let token = r.getString("token_ulasan");
  if (U.layak("pesanan", statusKirim)) {
    const hasil = U.tokenUntuk(token, r.getString("created"), Date.now(), Math.random);
    if (hasil.token) token = hasil.token;
    else if (hasil.kedaluwarsa) token = ""; // terlalu tua: tautan dimatikan
    if (token !== r.getString("token_ulasan")) r.set("token_ulasan", token);
  }

  // link_wa_ulasan: wa.me yang mengarah ke /ulasan?t=TOKEN (untuk dikirim pemilik ke pembeli)
  const lu = U.linkUlasanWA({
    wa: r.getString("wa"),
    jenis: "pesanan",
    nama: r.getString("pembeli"),
    nomor: r.getString("nomor"),
    token: token,
  }, { toko: "Cupil Stuff", situs: B.situsDariEnv() });
  r.set("link_wa_ulasan", lu.link_wa_ulasan);
}

module.exports = { isi };