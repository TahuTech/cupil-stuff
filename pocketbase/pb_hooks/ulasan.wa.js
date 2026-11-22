// Logika token ulasan + tautan WhatsApp untuk meminta ulasan (dipakai hook pesanan & tiket).
// Murni: tanpa $app. Diuji di web/src/lib/ulasan-wa-hook.test.ts.
// Ditulis tanpa sintaks baru (??, ?.) supaya aman di JSVM PocketBase.

const U = require((typeof __hooks !== "undefined" ? __hooks : __dirname) + "/ulasan.js");
const B = require((typeof __hooks !== "undefined" ? __hooks : __dirname) + "/bersama.js");

// Status yang membuat sebuah record layak diminta ulasannya (token dibuat otomatis).
const STATUS_LAYAK_PESANAN = ["dikirim", "selesai"]; // status_kirim
const STATUS_LAYAK_TIKET = ["dikirim"]; // status tiket_servis

/** Apakah status_kirim/status sebuah record layak untuk dimintai ulasan. */
function layak(jenis, status) {
  const daftar = jenis === "pesanan" ? STATUS_LAYAK_PESANAN : STATUS_LAYAK_TIKET;
  return daftar.indexOf(status) >= 0;
}

/**
 * Token ulasan yang berlaku. Bila token sudah ada tetapi kedaluwarsa, buat token baru.
 * Hasil: { token } atau { kedaluwarsa: true } bila token lama sudah lewat masa berlakunya
 * (record sumber dianggap terlalu tua untuk dimintai ulasan lagi).
 * Dibuat baru bila token kosong.
 */
function tokenUntuk(tokenLama, created, sekarangMs, acak) {
  if (tokenLama && !U.tokenKedaluwarsa(created, sekarangMs)) return { token: tokenLama };
  if (tokenLama && U.tokenKedaluwarsa(created, sekarangMs)) return { kedaluwarsa: true };
  return { token: U.buatToken(acak) };
}

/**
 * Tautan wa.me untuk pemilik toko meminta ulasan ke pembeli. "" jika belum berlaku.
 * p: { wa, jenis, nama, nomor, token }
 * opsi: { toko, situs }  (situs: alamat katalog, untuk tautan /ulasan?t=TOKEN)
 */
function linkUlasanWA(p, opsi) {
  const hasil = { link_wa_ulasan: "" };
  const wa = String(p.wa || "").replace(/\D/g, "");
  if (!wa || !p.token) return hasil;
  const tautan = B.tautanSitus(opsi.situs, "/ulasan?t=" + encodeURIComponent(p.token));
  if (!tautan) return hasil; // SITE_URL belum diisi: tidak ada tautan (tidak ada domain di kode)
  const halo = "Halo " + (p.nama || "Kak") + ",\n\n";
  let pesan;
  if (p.jenis === "tiket") {
    pesan = halo + "Terima kasih sudah servis di " + opsi.toko + " 🙏\n\nBoleh minta waktu sebentar untuk menulis ulasan pengalamanmu? " +
      "Ulasanmu sangat membantu kami. " + tautan + " (berlaku 30 hari).";
  } else {
    pesan = halo + "Terima kasih sudah berbelanja di " + opsi.toko + " 😊\n\nBoleh minta waktu sebentar untuk menulis ulasan produknya? " +
      "Ulasanmu sangat membantu kami. " + tautan + " (berlaku 30 hari).";
  }
  hasil.link_wa_ulasan = "https://wa.me/" + wa + "?text=" + encodeURIComponent(pesan);
  return hasil;
}

/** Label jenis untuk pesan. */
function labelJenis(jenis) {
  return jenis === "servis" ? "ulasan servis" : "ulasan produk";
}

/**
 * Pesan Telegram "ulasan baru menunggu persetujuan". Dipakai notifikasi.pb.js.
 * u: { id, jenis, bintang, nama_tampil, terverifikasi, ringkas }, apiUrl: alamat PocketBase publik.
 */
function pesanUlasanBaru(u, apiUrl) {
  const penuh = Math.max(1, Math.min(5, u.bintang || 0));
  const bintang = "⭐".repeat(penuh);
  const baris = [
    "📝 Ulasan baru menunggu persetujuan",
    labelJenis(u.jenis) + " · " + bintang + " (" + (u.bintang || 0) + "/5)",
    "Dari: " + (u.nama_tampil || "Anonim") + (u.terverifikasi ? " (pembeli terverifikasi)" : ""),
  ];
  if (u.ringkas) baris.push("“" + u.ringkas + "”");
  if (apiUrl) {
    baris.push(String(apiUrl).replace(/\/+$/, "") + "/_/#/collections?collection=ulasan&record=" + encodeURIComponent(u.id));
  }
  return baris.join("\n");
}

module.exports = {
  STATUS_LAYAK_PESANAN,
  STATUS_LAYAK_TIKET,
  layak,
  tokenUntuk,
  linkUlasanWA,
  labelJenis,
  pesanUlasanBaru,
};