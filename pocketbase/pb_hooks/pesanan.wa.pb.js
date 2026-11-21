/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Hook ongkir manual & link WhatsApp
// =============================================================================

onRecordUpdate((e) => {
  var baru = e.record;
  if (!baru) { e.next(); return; }

  // Cari record lama
  var lama;
  try { lama = e.app.findRecordById("pesanan", baru.id); } catch (_) { e.next(); return; }

  // --- Hitung ulang ongkir + potongan jika ongkir diisi manual ---
  var ongkirBaru = baru.getInt("ongkir");
  var ongkirKonfirmasi = baru.getBool("ongkir_konfirmasi");
  var ongkirLama = lama.getInt("ongkir");

  if (ongkirKonfirmasi && ongkirBaru > 0 && ongkirBaru !== ongkirLama) {
    var O = require(__hooks + "/ongkir.js");
    var subtotal = baru.getInt("subtotal");
    var potongan = O.potonganOngkir(subtotal, ongkirBaru);
    var total = subtotal + ongkirBaru - potongan;
    baru.set("potongan_ongkir", potongan);
    baru.set("total", total);
    baru.set("ongkir_konfirmasi", false);
  }

  // --- Isi link WhatsApp ---
  isiLinkWA(baru);
  e.next();
}, "pesanan");

function isiLinkWA(r) {
  var nomor = r.getString("nomor");
  var wa = r.getString("wa");
  var pembeli = r.getString("pembeli");
  var TOKO = "Cupil Stuff";
  if (!nomor || !wa) return;

  var waBersih = wa.replace(/\D/g, "");
  var base = "https://wa.me/" + waBersih + "?text=";

  // link_wa_ongkir: info total + link /bayar
  if (!r.getString("link_wa_ongkir")) {
    var total = r.getInt("total");
    var rp = "Rp " + total.toLocaleString("id-ID");
    var pesan = "Halo " + pembeli + ",\n\nTerima kasih sudah berbelanja di " + TOKO + " 😊\n\nPesanan *" + nomor + "*:\nTotal yang perlu dibayar: *" + rp + "*\n\nSilakan bayar melalui QRIS dan kirim bukti bayar ke WhatsApp ini. Rincian bisa dilihat di: https://cupilstuff.id/bayar?nomor=" + encodeURIComponent(nomor);
    r.set("link_wa_ongkir", base + encodeURIComponent(pesan));
  }

  // link_wa_lunas: konfirmasi pembayaran diterima
  if (!r.getString("link_wa_lunas") && r.getString("status_bayar") === "lunas") {
    var total = r.getInt("total");
    var rp = "Rp " + total.toLocaleString("id-ID");
    var pesan = "Halo " + pembeli + ",\n\nPembayaran untuk pesanan *" + nomor + "* sebesar *" + rp + "* sudah kami terima ✅\n\nPesanan akan segera kami proses dan dikirim. Info pengiriman akan kami kabari setelah resi tersedia.\n\nTerima kasih banyak! 😊";
    r.set("link_wa_lunas", base + encodeURIComponent(pesan));
  }

  // link_wa_resi: nomor resi + tautan lacak J&T
  var resi = r.getString("resi");
  if (!r.getString("link_wa_resi") && resi) {
    var pesan = "Halo " + pembeli + ",\n\nPesanan *" + nomor + "* sudah dikirim 📦\n\nNo. resi: *" + resi + "*\nLacak di: https://jet.co.id/cek-resi?resi=" + encodeURIComponent(resi) + "\n\nEstimasi tiba sesuai zona tujuan kamu ya. Kalau ada kendala hubungi kami lagi.\n\nTerima kasih sudah berbelanja di " + TOKO + "! 🙏";
    r.set("link_wa_resi", base + encodeURIComponent(pesan));
  }
}