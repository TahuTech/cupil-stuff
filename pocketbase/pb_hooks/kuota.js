// Pembatasan jumlah permintaan per IP untuk POST /api/checkout dan POST /api/servis.
// IP diambil sama seperti cekwa.js (header CF-Connecting-IP dari Cloudflare Tunnel).
// Hitungan per jendela waktu tetap (mulai dari permintaan pertama), disimpan di $app.store()
// (memori server; ter-reset saat PocketBase dijalankan ulang).

const dir = typeof __hooks !== "undefined" ? __hooks : __dirname;

const JAM = 60 * 60 * 1000;
const BATAS = {
  checkout: { dibuat: 10, percobaan: 30, durasi: JAM, benda: "pesanan" },
  servis: { dibuat: 10, percobaan: 30, durasi: JAM, benda: "tiket servis" },
  ulasan: { dibuat: 5, percobaan: 20, durasi: JAM, benda: "ulasan" },
};

// ---------- fungsi murni (diuji di web/src/lib/kuota-hook.test.ts) ----------

/** { penuh, sisaMs } untuk data hitungan { n, mulai } pada waktu `sekarang`. */
function status(data, sekarang, maks, durasi) {
  if (!data || !data.mulai || sekarang - data.mulai >= durasi) return { penuh: false, sisaMs: 0 };
  return data.n >= maks ? { penuh: true, sisaMs: data.mulai + durasi - sekarang } : { penuh: false, sisaMs: 0 };
}

function tambah(data, sekarang, durasi) {
  if (!data || !data.mulai || sekarang - data.mulai >= durasi) return { n: 1, mulai: sekarang };
  return { n: data.n + 1, mulai: data.mulai };
}

function pesanPenuh(jenis, benda, sisaMs) {
  const menit = Math.max(1, Math.ceil(sisaMs / 60000));
  if (jenis === "dibuat") {
    // "benda" untuk pesanan/tiket = objek yang dibuat; untuk ulasan = yang dikirim
    const awalan = benda === "ulasan" ? "mengirim" : "membuat";
    return "Kamu sudah " + awalan + " cukup banyak " + benda + " dalam satu jam terakhir. Coba lagi sekitar " + menit + " menit lagi, atau hubungi kami lewat WhatsApp.";
  }
  return "Terlalu banyak percobaan dalam satu jam terakhir. Coba lagi sekitar " + menit + " menit lagi, atau hubungi kami lewat WhatsApp.";
}

// ---------- dipakai route ----------

function kunci(e, nama, jenis) {
  return "kuota:" + nama + ":" + jenis + ":" + require(dir + "/cekwa.js").ipKlien(e);
}
function baca(k) {
  try { return JSON.parse($app.store().get(k) || "null"); } catch (_) { return null; }
}

/**
 * Dipanggil di awal route. Mencatat satu percobaan, lalu menolak jika kuota percobaan
 * atau kuota pembuatan sudah penuh. Hasil null (boleh lanjut) atau { status: 429, body }.
 */
function periksa(e, nama) {
  const b = BATAS[nama];
  const sekarang = Date.now();
  const kDibuat = kunci(e, nama, "dibuat");
  const kCoba = kunci(e, nama, "percobaan");

  const sDibuat = status(baca(kDibuat), sekarang, b.dibuat, b.durasi);
  if (sDibuat.penuh) return { status: 429, body: { pesan: pesanPenuh("dibuat", b.benda, sDibuat.sisaMs) } };

  const coba = baca(kCoba);
  const sCoba = status(coba, sekarang, b.percobaan, b.durasi);
  if (sCoba.penuh) return { status: 429, body: { pesan: pesanPenuh("percobaan", b.benda, sCoba.sisaMs) } };
  $app.store().set(kCoba, JSON.stringify(tambah(coba, sekarang, b.durasi)));
  return null;
}

/** Dipanggil setelah pesanan/tiket berhasil disimpan. */
function catatDibuat(e, nama) {
  const k = kunci(e, nama, "dibuat");
  $app.store().set(k, JSON.stringify(tambah(baca(k), Date.now(), BATAS[nama].durasi)));
}

module.exports = { BATAS, status, tambah, pesanPenuh, periksa, catatDibuat };
