// Turunan pesanan untuk pemilik toko (dipanggil pesanan.wa.pb.js lewat require; diuji di
// web/src/lib/pesanan-wa-hook.test.ts). Fungsi murni: tanpa $app.
// Ditulis tanpa sintaks baru (??, ?.) supaya aman di JSVM PocketBase.

const B = require((typeof __hooks !== "undefined" ? __hooks : __dirname) + "/bersama.js");
const O = require((typeof __hooks !== "undefined" ? __hooks : __dirname) + "/ongkir.js");

/**
 * Ongkir diisi manual untuk pesanan yang butuh konfirmasi (di atas 5 kg / zona tidak ada):
 * hitung ulang potongan dan total, lalu tandai ongkir sudah dikonfirmasi.
 * Hasil: { potongan_ongkir, total, ongkir_konfirmasi } atau null jika tidak ada yang berubah.
 */
function ongkirManual(p) {
  if (!p.ongkir_konfirmasi || !(p.ongkir > 0)) return null;
  const potongan = O.potonganOngkir(p.subtotal, p.ongkir);
  return { potongan_ongkir: potongan, total: p.subtotal + p.ongkir - potongan, ongkir_konfirmasi: false };
}

/**
 * Link wa.me ke pembeli. Selalu dihitung ulang dari data terbaru (tidak pernah basi).
 * p: { nomor, pembeli, wa, total, ongkir_konfirmasi, status_bayar, resi }
 * opsi: { toko, situs }
 */
function linkWA(p, opsi) {
  const hasil = { link_wa_ongkir: "", link_wa_lunas: "", link_wa_resi: "" };
  const wa = String(p.wa || "").replace(/\D/g, "");
  if (!p.nomor || !wa) return hasil;
  const ke = function (pesan) { return "https://wa.me/" + wa + "?text=" + encodeURIComponent(pesan); };
  const halo = "Halo " + (p.pembeli || "Kak") + ",\n\n";
  const halamanBayar = B.tautanSitus(opsi.situs, "/bayar?nomor=" + encodeURIComponent(p.nomor));

  // info total + cara bayar; hanya jika ongkir sudah pasti dan belum lunas/batal
  if (!p.ongkir_konfirmasi && p.status_bayar === "menunggu" && p.total > 0) {
    let pesan = halo + "Terima kasih sudah berbelanja di " + opsi.toko + " 😊\n\nPesanan *" + p.nomor + "*\nTotal yang perlu dibayar: *" + B.rp(p.total) + "*\n\nBayar lewat QRIS, lalu kirim bukti bayar ke WhatsApp ini.";
    if (halamanBayar) pesan += "\nQRIS dan rincian pesanan: " + halamanBayar + " (pakai 4 digit terakhir nomor WhatsApp ini).";
    hasil.link_wa_ongkir = ke(pesan);
  }

  if (p.status_bayar === "lunas") {
    hasil.link_wa_lunas = ke(halo + "Pembayaran pesanan *" + p.nomor + "* sebesar *" + B.rp(p.total) + "* sudah kami terima ✅\n\nPesanan segera kami kemas dan kirim. Nomor resi kami kabari setelah paket dikirim.\n\nTerima kasih! 😊");
  }

  const resi = String(p.resi || "").trim();
  if (resi) {
    hasil.link_wa_resi = ke(halo + "Pesanan *" + p.nomor + "* sudah dikirim 📦\n\n" + B.teksLacak(resi) + "\n\nTerima kasih sudah berbelanja di " + opsi.toko + "! 🙏");
  }
  return hasil;
}

module.exports = { ongkirManual, linkWA };
