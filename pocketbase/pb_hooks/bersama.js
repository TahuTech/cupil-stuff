// Fungsi kecil yang dipakai beberapa hook (pesanan dan tiket servis). Murni, tanpa $app.
// Pasangan di web: web/src/lib/format.ts (rupiah) dan web/src/lib/lacak.ts (lacak J&T),
// dijaga sama oleh web/src/lib/bersama-hook.test.ts.

/** "Rp 150.000" tanpa bergantung pada locale (JSVM PocketBase belum tentu mendukung id-ID). */
function rp(n) {
  return "Rp " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Alamat situs dari env SITE_URL (tanpa garis miring akhir). "" jika belum diisi. */
function situsDariEnv() {
  try {
    return String($os.getenv("SITE_URL") || "").trim().replace(/\/+$/, "");
  } catch (_) {
    return "";
  }
}

/** Tautan lengkap ke halaman katalog, atau "" jika SITE_URL belum diisi. */
function tautanSitus(situs, jalur) {
  return situs ? situs.replace(/\/+$/, "") + jalur : "";
}

// Halaman lacak resmi J&T Express Indonesia (menu Track & Trace). J&T tidak menerbitkan
// format URL yang menyertakan nomor resi, jadi nomor resi ditulis terpisah di pesan.
const URL_LACAK_JNT = "https://jet.co.id/track";

function linkLacakJNT() {
  return URL_LACAK_JNT;
}

/** Baris pesan lacak resi: nomor resi + halaman lacak J&T. */
function teksLacak(resi) {
  return "No. resi J&T: *" + resi + "*\nLacak di " + linkLacakJNT() + " (masukkan nomor resi di atas).";
}

module.exports = { rp, situsDariEnv, tautanSitus, URL_LACAK_JNT, linkLacakJNT, teksLacak };
