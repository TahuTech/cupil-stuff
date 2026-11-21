// Verifikasi 4 digit terakhir WA + pembatasan percobaan per IP.
// Dipakai route GET /api/pesanan dan GET /api/tiket (keduanya butuh pola yang sama).
// Mengembalikan { status, body } bila permintaan harus ditolak, atau null bila lolos.

const MAKS_PERCOBAAN = 5;
const DURASI_BLOKIR_MS = 15 * 60 * 1000;

/** Ambil IP klien dari request (lewat Cloudflare Tunnel: Cf-Connecting-Ip). Port dibuang. */
function ipKlien(e) {
  const info = e.requestInfo();
  const h = info.headers || {};
  const dariHeader = h["Cf-Connecting-Ip"] || h["X-Forwarded-For"] || "";
  let ip = String(dariHeader || e.request.remoteAddr || "0.0.0.0");
  // X-Forwarded-For bisa berisi daftar: ambil yang pertama
  ip = ip.split(",")[0].trim();
  // remoteAddr bisa "127.0.0.1:54321" → buang port
  if (ip.indexOf(":") >= 0 && ip.lastIndexOf(":") > ip.lastIndexOf("]")) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }
  return ip || "0.0.0.0";
}

function bacaKunci(kunci) {
  try {
    return JSON.parse($app.store().get(kunci) || "{}");
  } catch (_) {
    return {};
  }
}

/** Ambil parameter `wa` dari query string. Coba requestInfo().query dulu, lalu parsing rawQuery. */
function ambilWA4(e) {
  // 1) requestInfo().query (paling andal)
  try {
    var q = e.requestInfo().query || {};
    if (q.wa != null && String(q.wa) !== "") return String(q.wa).trim();
  } catch (_) {}
  // 2) fallback: parsing rawQuery manual
  var raw = "";
  try {
    raw = String(e.request.url.rawQuery || "");
  } catch (_) {
    raw = "";
  }
  var m = raw.match(/(?:^|&)wa=([^&]*)/);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]).trim();
  } catch (_) {
    return m[1].trim();
  }
}

/**
 * Periksa 4 digit WA untuk sebuah record.
 * record: Record PocketBase yang punya field "wa".
 * prefix: awalan kunci store, mis. "bayar" → "bayar:blok:<ip>".
 * Hasil:
 *   - null  → cocok, boleh lanjut
 *   - { status: number, body: object } → tolak (400/403/429)
 */
function cekWA(e, record, wa4, prefix) {
  if (!/^\d{4}$/.test(wa4)) {
    return { status: 400, body: { pesan: "Masukkan 4 digit terakhir nomor WhatsApp." } };
  }

  const kunci = prefix + ":blok:" + ipKlien(e);
  const data = bacaKunci(kunci);

  if (data.sampai && Date.now() < data.sampai) {
    const sisa = Math.ceil((data.sampai - Date.now()) / 60000);
    return { status: 429, body: { pesan: "Terlalu banyak percobaan. Coba lagi " + sisa + " menit lagi." } };
  }

  const wa = String(record.getString("wa") || "").replace(/\D/g, "");
  if (wa.length < 4 || wa.slice(-4) !== wa4) {
    const gagal = (data.gagal || 0) + 1;
    $app.store().set(kunci, JSON.stringify({
      gagal: gagal,
      sampai: gagal >= MAKS_PERCOBAAN ? Date.now() + DURASI_BLOKIR_MS : 0,
    }));
    return { status: 403, body: { pesan: "4 digit terakhir tidak cocok." } };
  }

  $app.store().remove(kunci);
  return null;
}

module.exports = { MAKS_PERCOBAAN, DURASI_BLOKIR_MS, ipKlien, ambilWA4, cekWA };