// Logika ulasan yang murni (tanpa $app), dipakai ulasan.api.pb.js, turunan, dan
// diuji di web/src/lib/ulasan-hook.test.ts.
// Prinsip: isian dari browser tidak dipercaya. Token divalidasi di server, ulasan dari
// link khusus = terverifikasi, dan ulasan hanya tampil setelah disetujui pemilik.
// Ditulis tanpa sintaks baru (??, ?.) supaya aman di JSVM PocketBase.

const B = require((typeof __hooks !== "undefined" ? __hooks : __dirname) + "/bersama.js");

const BATAS = {
  bintang: [1, 5],
  komentar: [0, 500], // komentar boleh kosong
  nama: [0, 60], // nama tampil boleh kosong (fallback "Anonim")
  foto: 3,
  fotoBytes: 5 * 1024 * 1024, // per foto (sama dengan maxSize field foto)
  token: [20, 100], // panjang token link ulasan
  umurTokenHari: 30, // token berlaku 30 hari
};

// -- token link ulasan -------------------------------------------------------

// Huruf & angka tanpa 0/O dan 1/I (mirip nomor) supaya tidak tertukar saat dibaca.
const HURUF_TOKEN = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Token acak 32 karakter (fungsi acak seperti Math.random). */
function buatToken(acak) {
  let t = "";
  for (let i = 0; i < 32; i++) t += HURUF_TOKEN.charAt(Math.floor(acak() * HURUF_TOKEN.length));
  return t;
}

/** Token berbentuk wajar (dipakai sebelum mencari record). */
function tokenWajar(token) {
  if (typeof token !== "string") return false;
  const t = token.trim();
  return t.length >= BATAS.token[0] && t.length <= BATAS.token[1] && /^[A-Za-z0-9]+$/.test(t);
}

/** Token kedaluwarsa bila dibuat lebih dari `umurHari` yang lalu. created: ISO string. */
function tokenKedaluwarsa(created, sekarangMs, umurHari) {
  if (!created) return false;
  const t = Date.parse(String(created).replace(" ", "T"));
  if (isNaN(t)) return false;
  const umur = (umurHari == null ? BATAS.umurTokenHari : umurHari) * 24 * 60 * 60 * 1000;
  return sekarangMs - t > umur;
}

/** Token sudah dipakai (ada ulasan dengan token ini). */
function tokenTerpakai(app, token) {
  if (!token) return false;
  try {
    const ada = app.findFirstRecordByData("ulasan", "token", token);
    return !!ada;
  } catch (_) {
    return false;
  }
}

// -- validasi isian ulasan ---------------------------------------------------

function teks(v, pertahankanBaris) {
  if (typeof v !== "string") return "";
  const t = pertahankanBaris ? v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : v.replace(/\s+/g, " ");
  return t.trim();
}

/**
 * Validasi isian ulasan dari form /ulasan.
 * jenis: "produk" | "servis" (ditentukan token, bukan dari browser).
 * Hasil: { ok: true, data } atau { ok: false, galat: { field: pesan } }.
 */
function validasiInput(body) {
  const galat = {};
  if (!body || typeof body !== "object") return { ok: false, galat: { umum: "Data ulasan tidak terbaca." } };

  const bintang = Number(body.bintang);
  if (!Number.isInteger(bintang) || bintang < BATAS.bintang[0] || bintang > BATAS.bintang[1]) {
    galat.bintang = "Pilih 1–5 bintang.";
  }

  const komentar = teks(body.komentar, true);
  if (komentar.length > BATAS.komentar[1]) galat.komentar = "Ulasan maksimal 500 huruf.";

  const nama = teks(body.nama_tampil);
  if (nama.length > BATAS.nama[1]) galat.nama_tampil = "Nama tampil maksimal 60 huruf.";

  // izin_tampil hanya boleh true/false (checkbox: "on"/true → true)
  const izin = body.izin_tampil === true || body.izin_tampil === "true" || body.izin_tampil === "on" || body.izin_tampil === 1 || body.izin_tampil === "1";

  if (Object.keys(galat).length) return { ok: false, galat: galat };
  return { ok: true, data: { bintang: bintang, komentar: komentar, nama_tampil: nama, izin_tampil: izin } };
}

/** Periksa jumlah dan ukuran foto. daftar: [{ size }]. Hasil: pesan galat atau "". */
function validasiFoto(daftar) {
  if (daftar.length > BATAS.foto) return "Maksimal " + BATAS.foto + " foto.";
  for (let i = 0; i < daftar.length; i++) {
    if (!(daftar[i].size > 0)) return "Ada foto yang kosong atau rusak.";
    if (daftar[i].size > BATAS.fotoBytes) return "Ukuran foto maksimal 5 MB per foto.";
  }
  return "";
}

// -- label tampilan ----------------------------------------------------------

const SUMBER_LABEL = {
  situs: "Pembeli terverifikasi", // hanya untuk terverifikasi = true
  whatsapp: "via WhatsApp",
  marketplace: "dari marketplace",
  lainnya: "dari pelanggan",
};

/**
 * Label sumber untuk ditampilkan di kartu ulasan.
 * terverifikasi = true → "Pembeli terverifikasi"; selain itu label sumbernya.
 */
function labelSumber(terverifikasi, sumber) {
  if (terverifikasi) return SUMBER_LABEL.situs;
  return SUMBER_LABEL[sumber] || SUMBER_LABEL.lainnya;
}

// -- respons publik ----------------------------------------------------------

/**
 * Data ulasan yang boleh dilihat publik (build halaman statis).
 * HANYA field tampilan; TIDAK PERNAH menyertakan relasi pesanan/tiket, token, atau data pribadi.
 * sumberTampil: label yang sudah dihitung (labelSumber).
 */
function responsPublik(u) {
  return {
    id: u.id,
    jenis: u.jenis,
    produk: u.produk || null,
    jasa: u.jasa || null,
    bintang: u.bintang,
    komentar: u.komentar || "",
    foto: Array.isArray(u.foto) ? u.foto : [],
    nama_tampil: u.nama_tampil || "Anonim",
    sumber: u.sumber || "lainnya",
    terverifikasi: !!u.terverifikasi,
  };
}

module.exports = {
  BATAS,
  HURUF_TOKEN,
  SUMBER_LABEL,
  buatToken,
  tokenWajar,
  tokenKedaluwarsa,
  tokenTerpakai,
  validasiInput,
  validasiFoto,
  labelSumber,
  responsPublik,
  rp: B.rp,
};