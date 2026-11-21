// Logika servis yang murni (tanpa $app), dipakai servis.pb.js lewat require()
// dan diuji di web/src/lib/servis-hook.test.ts.
// Prinsip sama dengan pesanan: isian browser tidak dipercaya, validasi di server.

const BATAS = {
  nama: [2, 80],
  perangkat: [2, 80],
  keluhan: [10, 1000],
  foto: 5, // maks foto
};

function teks(v, pertahankanBaris) {
  if (typeof v !== "string") return "";
  const t = pertahankanBaris ? v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : v.replace(/\s+/g, " ");
  return t.trim();
}

/** Sama dengan pesanan.js: "0812…"/"+62 812…"/"812…" → "628…"; null jika bukan nomor HP Indonesia. */
function normalisasiWA(v) {
  let d = String(v == null ? "" : v).replace(/\D/g, "");
  if (d.indexOf("0") === 0) d = "62" + d.slice(1);
  else if (d.indexOf("8") === 0) d = "62" + d;
  return /^628\d{7,11}$/.test(d) ? d : null;
}

const POLA_ID = /^[a-z0-9]{15}$/;
const CARA_KIRIM = ["kurir", "antar"];

/** Validasi isian form servis. Hasil: { ok: true, data } atau { ok: false, galat: { field: pesan } }. */
function validasiInput(body) {
  const galat = {};
  if (!body || typeof body !== "object") return { ok: false, galat: { umum: "Data servis tidak terbaca." } };

  const nama = teks(body.nama);
  if (nama.length < BATAS.nama[0] || nama.length > BATAS.nama[1]) galat.nama = "Nama 2–80 huruf.";

  const wa = normalisasiWA(body.wa);
  if (!wa) galat.wa = "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.";

  const perangkat = teks(body.perangkat);
  if (perangkat.length < BATAS.perangkat[0] || perangkat.length > BATAS.perangkat[1]) {
    galat.perangkat = "Isi jenis perangkat (mis. Logitech G102).";
  }

  const keluhan = teks(body.keluhan, true);
  if (keluhan.length < BATAS.keluhan[0] || keluhan.length > BATAS.keluhan[1]) {
    galat.keluhan = "Ceritakan keluhannya 10–1000 huruf.";
  }

  const cara_kirim = teks(body.cara_kirim);
  if (CARA_KIRIM.indexOf(cara_kirim) < 0) galat.cara_kirim = "Pilih cara pengiriman.";

  // jasa opsional: id record jasa, atau kosong
  let jasa = null;
  if (body.jasa != null && body.jasa !== "") {
    if (typeof body.jasa !== "string" || !POLA_ID.test(body.jasa)) galat.jasa = "Jenis jasa tidak valid.";
    else jasa = body.jasa;
  }

  if (Object.keys(galat).length) return { ok: false, galat: galat };
  return { ok: true, data: { nama: nama, wa: wa, perangkat: perangkat, keluhan: keluhan, cara_kirim: cara_kirim, jasa: jasa } };
}

const HURUF_NOMOR = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O dan 1/I

/** Nomor tiket SRV-YYMMDD-XXXX (tanggal WIB). acak: fungsi seperti Math.random. */
function buatNomor(waktuMs, acak) {
  const d = new Date(waktuMs + 7 * 3600 * 1000);
  const dua = function (n) { return (n < 10 ? "0" : "") + n; };
  let akhir = "";
  for (let i = 0; i < 4; i++) akhir += HURUF_NOMOR.charAt(Math.floor(acak() * HURUF_NOMOR.length));
  return "SRV-" + dua(d.getUTCFullYear() % 100) + dua(d.getUTCMonth() + 1) + dua(d.getUTCDate()) + "-" + akhir;
}

/** Pesan status untuk pembeli (dipakai halaman /cek-tiket). */
const LABEL_STATUS = {
  menunggu_perangkat: "Menunggu perangkat dikirim",
  diterima: "Perangkat sudah diterima",
  dicek: "Sedang dicek",
  menunggu_persetujuan: "Menunggu persetujuan estimasi",
  dikerjakan: "Sedang dikerjakan",
  selesai: "Servis selesai",
  dikirim: "Sedang dikirim balik",
  dikembalikan: "Perangkat dikembalikan",
};

module.exports = { BATAS, normalisasiWA, validasiInput, buatNomor, LABEL_STATUS };