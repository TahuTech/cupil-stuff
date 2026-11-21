// Verifikasi 4 digit terakhir WA + pembatasan percobaan per IP.
// Dipakai route GET /api/pesanan dan GET /api/tiket (keduanya butuh pola yang sama).

const MAKS_PERCOBAAN = 5; // percobaan gagal per jendela waktu
const DURASI_BLOKIR_MS = 15 * 60 * 1000; // jendela hitung sekaligus lama blokir

/**
 * IP klien. Di produksi semua permintaan lewat Cloudflare Tunnel, yang mengisi header
 * CF-Connecting-IP dengan IP asli pengunjung (nilai dari pengunjung ditimpa Cloudflare).
 * PocketBase menyajikan header dengan kunci huruf kecil + garis bawah: "cf_connecting_ip".
 * X-Forwarded-For sengaja TIDAK dipakai karena bisa dipalsukan pengunjung.
 */
function ipKlien(e) {
  let ip = "";
  try {
    const h = e.requestInfo().headers || {};
    ip = String(h.cf_connecting_ip || "").split(",")[0].trim();
  } catch (_) {}
  if (!ip) {
    try {
      ip = e.realIP();
    } catch (_) {
      ip = String(e.request.remoteAddr || "");
      if (ip.lastIndexOf(":") > ip.lastIndexOf("]")) ip = ip.slice(0, ip.lastIndexOf(":"));
    }
  }
  return ip || "0.0.0.0";
}

/** Ambil parameter `wa` dari query string. */
function ambilWA4(e) {
  try {
    const q = e.requestInfo().query || {};
    if (q.wa != null && String(q.wa) !== "") return String(q.wa).trim();
  } catch (_) {}
  let raw = "";
  try {
    raw = String(e.request.url.rawQuery || "");
  } catch (_) {}
  const m = raw.match(/(?:^|&)wa=([^&]*)/);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]).trim();
  } catch (_) {
    return m[1].trim();
  }
}

// ---------- hitungan percobaan gagal (fungsi murni, diuji di cekwa-hook.test.ts) ----------

/** Status blokir untuk data hitungan { gagal, mulai } pada waktu `sekarang`. */
function statusBlokir(data, sekarang) {
  if (!data || !data.mulai || sekarang - data.mulai >= DURASI_BLOKIR_MS) return { diblokir: false, sisaMs: 0 };
  if ((data.gagal || 0) < MAKS_PERCOBAAN) return { diblokir: false, sisaMs: 0 };
  return { diblokir: true, sisaMs: data.mulai + DURASI_BLOKIR_MS - sekarang };
}

/** Catat satu percobaan gagal. Jendela baru dimulai jika jendela lama sudah lewat. */
function catatGagal(data, sekarang) {
  if (!data || !data.mulai || sekarang - data.mulai >= DURASI_BLOKIR_MS) return { gagal: 1, mulai: sekarang };
  return { gagal: (data.gagal || 0) + 1, mulai: data.mulai };
}

function kunciIP(e, prefix) {
  return prefix + ":gagal:" + ipKlien(e);
}

function baca(kunci) {
  try {
    return JSON.parse($app.store().get(kunci) || "null");
  } catch (_) {
    return null;
  }
}

/** Tolak lebih awal jika IP sedang diblokir. Hasil null atau { status, body }. */
function cekBlokir(e, prefix) {
  const s = statusBlokir(baca(kunciIP(e, prefix)), Date.now());
  if (!s.diblokir) return null;
  return { status: 429, body: { pesan: "Terlalu banyak percobaan. Coba lagi " + Math.ceil(s.sisaMs / 60000) + " menit lagi." } };
}

/** Catat percobaan gagal (4 digit salah atau nomor tidak ditemukan). */
function gagal(e, prefix) {
  const k = kunciIP(e, prefix);
  $app.store().set(k, JSON.stringify(catatGagal(baca(k), Date.now())));
}

/**
 * Periksa 4 digit WA untuk sebuah record (field "wa").
 * Hasil null jika cocok, atau { status, body } untuk ditolak (400/403/429).
 * Percobaan yang berhasil TIDAK mereset hitungan; hitungan habis sendiri setelah jendela waktu.
 */
function cekWA(e, record, wa4, prefix) {
  if (!/^\d{4}$/.test(wa4)) {
    return { status: 400, body: { pesan: "Masukkan 4 digit terakhir nomor WhatsApp." } };
  }
  const blokir = cekBlokir(e, prefix);
  if (blokir) return blokir;

  const wa = String(record.getString("wa") || "").replace(/\D/g, "");
  if (wa.length < 4 || wa.slice(-4) !== wa4) {
    gagal(e, prefix);
    return { status: 403, body: { pesan: "4 digit terakhir tidak cocok." } };
  }
  return null;
}

module.exports = { MAKS_PERCOBAAN, DURASI_BLOKIR_MS, ipKlien, ambilWA4, statusBlokir, catatGagal, cekBlokir, gagal, cekWA };
