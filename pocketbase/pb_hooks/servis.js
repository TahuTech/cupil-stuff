// Logika servis yang murni (tanpa $app), dipakai servis.pb.js, tiket.pb.js, dan
// tiket.hitung.pb.js lewat require(), dan diuji di web/src/lib/servis-hook.test.ts.
// Prinsip sama dengan pesanan: isian browser tidak dipercaya; semua angka tagihan
// dihitung di server. Aturan bisnis: CLAUDE.md, bagian "Jasa servis".
// Ditulis tanpa sintaks baru (??, ?.) supaya aman di JSVM PocketBase.

// __hooks tersedia di PocketBase, __dirname di Node (unit test)
const ongkir = require((typeof __hooks !== "undefined" ? __hooks : __dirname) + "/ongkir.js");

const BATAS = {
  nama: [2, 80],
  perangkat: [2, 80],
  keluhan: [10, 1000],
  provinsi: 60,
  foto: 5, // maks foto
  fotoBytes: 5 * 1024 * 1024, // per foto (sama dengan maxSize field foto)
};

const PERANGKAT_JENIS = ["mouse", "keyboard", "lainnya"];

/** Berat bawaan kirim balik per jenis perangkat (gram, sudah termasuk packing). */
const BERAT_PERANGKAT = { mouse: 300, keyboard: 900, lainnya: 500 };

const CARA_KIRIM = ["kurir", "antar"];

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

/** Validasi isian form servis. Hasil: { ok: true, data } atau { ok: false, galat: { field: pesan } }. */
function validasiInput(body) {
  const galat = {};
  if (!body || typeof body !== "object") return { ok: false, galat: { umum: "Data servis tidak terbaca." } };

  const nama = teks(body.nama);
  if (nama.length < BATAS.nama[0] || nama.length > BATAS.nama[1]) galat.nama = "Nama 2–80 huruf.";

  const wa = normalisasiWA(body.wa);
  if (!wa) galat.wa = "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.";

  const perangkat_jenis = teks(body.perangkat_jenis);
  if (PERANGKAT_JENIS.indexOf(perangkat_jenis) < 0) galat.perangkat_jenis = "Pilih jenis perangkat.";

  const perangkat = teks(body.perangkat);
  if (perangkat.length < BATAS.perangkat[0] || perangkat.length > BATAS.perangkat[1]) {
    galat.perangkat = "Isi merek/tipe perangkat 2–80 huruf (mis. Logitech G102).";
  }

  const keluhan = teks(body.keluhan, true);
  if (keluhan.length < BATAS.keluhan[0] || keluhan.length > BATAS.keluhan[1]) {
    galat.keluhan = "Ceritakan keluhannya 10–1000 huruf.";
  }

  const cara_kirim = teks(body.cara_kirim);
  if (CARA_KIRIM.indexOf(cara_kirim) < 0) galat.cara_kirim = "Pilih cara kirim perangkat.";

  // provinsi kirim balik: wajib jika lewat kurir, diabaikan jika antar langsung
  let provinsi = "";
  if (cara_kirim === "kurir") {
    provinsi = teks(body.provinsi);
    if (!provinsi || provinsi.length > BATAS.provinsi) galat.provinsi = "Pilih provinsi untuk kirim balik.";
  }

  // jasa opsional: id record jasa, atau kosong
  let jasa = null;
  if (body.jasa != null && body.jasa !== "") {
    if (typeof body.jasa !== "string" || !POLA_ID.test(body.jasa)) galat.jasa = "Jenis servis tidak valid.";
    else jasa = body.jasa;
  }

  if (Object.keys(galat).length) return { ok: false, galat: galat };
  return {
    ok: true,
    data: { nama: nama, wa: wa, perangkat_jenis: perangkat_jenis, perangkat: perangkat, keluhan: keluhan, cara_kirim: cara_kirim, provinsi: provinsi, jasa: jasa },
  };
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

const HURUF_NOMOR = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O dan 1/I

/** Nomor tiket SRV-YYMMDD-XXXX (tanggal WIB). acak: fungsi seperti Math.random. */
function buatNomor(waktuMs, acak) {
  const d = new Date(waktuMs + 7 * 3600 * 1000);
  const dua = function (n) { return (n < 10 ? "0" : "") + n; };
  let akhir = "";
  for (let i = 0; i < 4; i++) akhir += HURUF_NOMOR.charAt(Math.floor(acak() * HURUF_NOMOR.length));
  return "SRV-" + dua(d.getUTCFullYear() % 100) + dua(d.getUTCMonth() + 1) + dua(d.getUTCDate()) + "-" + akhir;
}

/** Label status untuk pembeli (dipakai halaman /cek-tiket). */
const LABEL_STATUS = {
  menunggu_perangkat: "Menunggu perangkat",
  diterima: "Perangkat diterima",
  dicek: "Sedang dicek",
  menunggu_persetujuan: "Menunggu persetujuan",
  dikerjakan: "Sedang dikerjakan",
  selesai: "Servis selesai",
  dikirim: "Dikirim balik",
  dikembalikan: "Dikembalikan",
};

// ---------- ongkir kirim balik dan tagihan ----------

/**
 * Ongkir kirim balik: zona yang sama dengan belanja, berat bawaan per jenis perangkat,
 * tanpa potongan ongkir (potongan hanya untuk belanja barang).
 * Hasil: 0 jika antar langsung, angka jika zona ditemukan, null jika belum bisa dihitung.
 * zona: [{ provinsi: [...], tarif_per_kg }]
 */
function ongkirKirimBalik(cara_kirim, provinsi, perangkat_jenis, zona) {
  if (cara_kirim === "antar") return 0;
  const z = (zona || []).filter(function (x) { return (x.provinsi || []).indexOf(provinsi) >= 0; })[0];
  if (!z) return null;
  const berat = BERAT_PERANGKAT[perangkat_jenis] || BERAT_PERANGKAT.lainnya;
  const h = ongkir.hitungOngkir(berat, z.tarif_per_kg, 0);
  return h.otomatis ? h.ongkir : null;
}

/**
 * Tagihan untuk pembeli, sesuai status:
 * - selesai / dikirim: biaya servis (biaya_final, atau estimasi jika final belum diisi) + ongkir kirim balik
 *   (0 jika antar). Tagihan tetap tercatat setelah perangkat dikirim balik.
 * - dikembalikan (estimasi ditolak): HANYA ongkir kirim balik; antar langsung = tidak ada tagihan
 * - status lain: null (belum ada tagihan)
 * Bagian yang belum diketahui bernilai null dan total ikut null ("dikabari via WhatsApp").
 * lunas: true jika pemilik toko sudah menandai status_bayar = "lunas".
 * t: { status, status_bayar, cara_kirim, estimasi_biaya, biaya_final, ongkir_kirim_balik }
 */
function hitungTagihan(t) {
  const lunas = t.status_bayar === "lunas";
  const kurir = t.cara_kirim !== "antar";
  // untuk kurir, 0 berarti ongkir kirim balik belum diisi
  const ongkirKB = kurir ? (t.ongkir_kirim_balik > 0 ? t.ongkir_kirim_balik : null) : 0;

  if (t.status === "dikembalikan") {
    if (!kurir) return { jenis: "tidak_ada", biaya: 0, ongkir_kirim_balik: 0, total: 0, perlu_bayar: false, lunas: false };
    return { jenis: "kirim_balik", biaya: 0, ongkir_kirim_balik: ongkirKB, total: ongkirKB, perlu_bayar: !lunas, lunas: lunas };
  }
  if (t.status === "selesai" || t.status === "dikirim") {
    const biaya = t.biaya_final > 0 ? t.biaya_final : t.estimasi_biaya > 0 ? t.estimasi_biaya : null;
    const total = biaya !== null && ongkirKB !== null ? biaya + ongkirKB : null;
    return { jenis: "servis", biaya: biaya, ongkir_kirim_balik: ongkirKB, total: total, perlu_bayar: !lunas, lunas: lunas };
  }
  return null;
}

/**
 * Total tagihan yang disimpan di record (field total_tagihan) untuk panel admin.
 * Dihitung untuk status saat ini; jika belum selesai/dikembalikan, dihitung seolah-olah selesai.
 */
function totalTagihan(t) {
  const status = t.status === "dikembalikan" ? "dikembalikan" : "selesai";
  const h = hitungTagihan({ status: status, cara_kirim: t.cara_kirim, estimasi_biaya: t.estimasi_biaya, biaya_final: t.biaya_final, ongkir_kirim_balik: t.ongkir_kirim_balik });
  return h && h.total !== null ? h.total : 0;
}

// ---------- link WhatsApp untuk pemilik toko (field url terhitung) ----------

/** "Rp 150.000" tanpa bergantung pada locale (JSVM PocketBase belum tentu mendukung id-ID). */
function rp(n) {
  return "Rp " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Link wa.me untuk pemilik toko mengirim kabar ke pembeli. "" jika belum berlaku.
 * t: { nomor, nama, wa, status, cara_kirim, estimasi_biaya, biaya_final, ongkir_kirim_balik, resi }
 * opsi: { toko, situs }  (situs: alamat katalog, untuk tautan /cek-tiket)
 */
function linkWA(t, opsi) {
  const kosong = { link_wa_diterima: "", link_wa_estimasi: "", link_wa_selesai: "", link_wa_lunas: "", link_wa_resi: "" };
  const wa = String(t.wa || "").replace(/\D/g, "");
  if (!t.nomor || !wa) return kosong;
  const halo = "Halo " + (t.nama || "Kak") + ",\n\n";
  const cek = "\n\nCek status kapan saja: " + opsi.situs.replace(/\/$/, "") + "/cek-tiket?nomor=" + encodeURIComponent(t.nomor) + " (pakai 4 digit terakhir nomor WhatsApp ini).";
  const ke = function (pesan) { return "https://wa.me/" + wa + "?text=" + encodeURIComponent(pesan); };
  const hasil = { link_wa_diterima: "", link_wa_estimasi: "", link_wa_selesai: "", link_wa_lunas: "", link_wa_resi: "" };

  if (t.status && t.status !== "menunggu_perangkat") {
    hasil.link_wa_diterima = ke(halo + "Perangkat untuk tiket servis *" + t.nomor + "* sudah kami terima. Kami cek dulu (gratis), lalu kami kabari estimasi biayanya sebelum dikerjakan." + cek);
  }

  if (t.estimasi_biaya > 0) {
    let tolak = "Kalau tidak setuju, perangkat kami kembalikan";
    if (t.cara_kirim === "antar") tolak += " dan bisa diambil langsung tanpa biaya.";
    else if (t.ongkir_kirim_balik > 0) tolak += "; kamu hanya membayar ongkir kirim balik " + rp(t.ongkir_kirim_balik) + ".";
    else tolak += "; kamu hanya membayar ongkir kirim balik.";
    hasil.link_wa_estimasi = ke(halo + "Hasil pengecekan tiket *" + t.nomor + "*: estimasi biaya servis *" + rp(t.estimasi_biaya) + "*.\n\nBalas *SETUJU* supaya kami kerjakan. " + tolak + cek);
  }

  const tagihan = hitungTagihan(t);
  if (tagihan && tagihan.jenis === "tidak_ada") {
    hasil.link_wa_selesai = ke(halo + "Perangkat untuk tiket *" + t.nomor + "* sudah bisa diambil. Tidak ada biaya. Terima kasih!");
  } else if (tagihan && tagihan.total !== null) {
    let rinci;
    if (tagihan.jenis === "kirim_balik") {
      rinci = "Perangkat untuk tiket *" + t.nomor + "* kami kirim balik sesuai permintaan. Tagihan hanya ongkir kirim balik: *" + rp(tagihan.total) + "*.";
    } else {
      rinci = "Servis tiket *" + t.nomor + "* sudah selesai ✅\n\nBiaya servis: " + rp(tagihan.biaya);
      if (tagihan.ongkir_kirim_balik > 0) rinci += "\nOngkir kirim balik: " + rp(tagihan.ongkir_kirim_balik);
      rinci += "\nTotal: *" + rp(tagihan.total) + "*";
    }
    hasil.link_wa_selesai = ke(halo + rinci + "\n\nBayar lewat QRIS di halaman cek tiket, lalu kirim bukti bayar ke WhatsApp ini." + cek);
  }

  if (tagihan && tagihan.lunas && tagihan.total !== null && tagihan.total > 0) {
    hasil.link_wa_lunas = ke(halo + "Pembayaran untuk tiket *" + t.nomor + "* sebesar *" + rp(tagihan.total) + "* sudah kami terima ✅\n\n" +
      (t.cara_kirim === "antar" ? "Perangkat bisa diambil sesuai janji temu." : "Perangkat segera kami kirim balik; nomor resi kami kabari setelah dikirim.") + "\n\nTerima kasih!");
  }

  const resi = String(t.resi || "").trim();
  if (resi) {
    hasil.link_wa_resi = ke(halo + "Perangkat untuk tiket *" + t.nomor + "* sudah dikirim balik 📦\n\nNo. resi J&T: *" + resi + "*\nLacak: https://jet.co.id/track?awb=" + encodeURIComponent(resi) + "\n\nTerima kasih sudah servis di " + opsi.toko + "!");
  }
  return hasil;
}

// ---------- respons publik /api/tiket ----------

/**
 * Data tiket yang boleh dilihat publik (dengan nomor + 4 digit WA).
 * HANYA: status, nama jasa, perangkat, estimasi biaya, biaya final, ongkir kirim balik,
 * tanggal, dan tagihan yang dihitung dari angka-angka itu.
 * TIDAK PERNAH: nama, nomor WA, keluhan, foto, provinsi, alamat, link WA.
 */
function responsPublik(t, namaJasa) {
  const status = t.status || "menunggu_perangkat";
  return {
    nomor: t.nomor,
    status: status,
    status_label: LABEL_STATUS[status] || status,
    jasa: namaJasa || null,
    perangkat: t.perangkat || "",
    estimasi_biaya: t.estimasi_biaya > 0 ? t.estimasi_biaya : null,
    biaya_final: t.biaya_final > 0 ? t.biaya_final : null,
    ongkir_kirim_balik: t.cara_kirim === "antar" ? 0 : t.ongkir_kirim_balik > 0 ? t.ongkir_kirim_balik : null,
    tagihan: hitungTagihan(t),
    dibuat: t.created || "",
    diperbarui: t.updated || "",
  };
}

module.exports = {
  BATAS, PERANGKAT_JENIS, BERAT_PERANGKAT, LABEL_STATUS,
  normalisasiWA, validasiInput, validasiFoto, buatNomor,
  ongkirKirimBalik, hitungTagihan, totalTagihan, linkWA, responsPublik, rp,
};
