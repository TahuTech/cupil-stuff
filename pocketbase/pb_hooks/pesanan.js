// Logika checkout yang murni (tanpa $app), dipakai checkout.pb.js lewat require()
// dan diuji di web/src/lib/pesanan-hook.test.ts.
// Prinsip: isian dari browser tidak dipercaya. Harga, stok, berat, zona, ongkir,
// potongan, dan total selalu dihitung ulang di sini dari data database.

// __hooks tersedia di PocketBase, __dirname di Node (unit test)
const ongkir = require((typeof __hooks !== "undefined" ? __hooks : __dirname) + "/ongkir.js");

const BATAS = {
  item: 20, // jenis barang per pesanan
  jumlah: 99, // per barang
  nama: [2, 80],
  alamat: [10, 500],
  provinsi: [2, 60],
  warna: 40,
};

function teks(v, pertahankanBaris) {
  if (typeof v !== "string") return "";
  const t = pertahankanBaris ? v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : v.replace(/\s+/g, " ");
  return t.trim();
}

/** "0812-3456-7890", "+62 812…", "812…" → "6281234567890"; null jika bukan nomor HP Indonesia. */
function normalisasiWA(v) {
  let d = String(v == null ? "" : v).replace(/\D/g, "");
  if (d.indexOf("0") === 0) d = "62" + d.slice(1);
  else if (d.indexOf("8") === 0) d = "62" + d;
  return /^628\d{7,11}$/.test(d) ? d : null;
}

const POLA_ID = /^[a-z0-9]{15}$/; // format id record PocketBase

/** Validasi bentuk isian. Hasil: { ok: true, data } atau { ok: false, galat: { field: pesan } }. */
function validasiInput(body) {
  const galat = {};
  if (!body || typeof body !== "object") return { ok: false, galat: { umum: "Data pesanan tidak terbaca." } };

  const nama = teks(body.nama);
  if (nama.length < BATAS.nama[0] || nama.length > BATAS.nama[1]) galat.nama = "Nama 2–80 huruf.";

  const wa = normalisasiWA(body.wa);
  if (!wa) galat.wa = "Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.";

  const alamat = teks(body.alamat, true);
  if (alamat.length < BATAS.alamat[0] || alamat.length > BATAS.alamat[1]) galat.alamat = "Alamat lengkap 10–500 huruf.";

  const provinsi = teks(body.provinsi);
  if (provinsi.length < BATAS.provinsi[0] || provinsi.length > BATAS.provinsi[1]) galat.provinsi = "Pilih provinsi tujuan.";

  // item: gabungkan varian + warna yang sama
  const items = [];
  if (!Array.isArray(body.items) || body.items.length === 0) {
    galat.items = "Keranjang kosong.";
  } else if (body.items.length > BATAS.item) {
    galat.items = "Maksimal " + BATAS.item + " barang per pesanan.";
  } else {
    for (let i = 0; i < body.items.length; i++) {
      const it = body.items[i] || {};
      const warna = it.warna == null || it.warna === "" ? null : teks(it.warna);
      if (typeof it.varian !== "string" || !POLA_ID.test(it.varian) || !Number.isInteger(it.jumlah) ||
          it.jumlah < 1 || it.jumlah > BATAS.jumlah || (warna !== null && warna.length > BATAS.warna)) {
        galat.items = "Ada barang yang tidak valid di keranjang.";
        break;
      }
      const ada = items.filter(function (x) { return x.varian === it.varian && x.warna === warna; })[0];
      if (ada) ada.jumlah = Math.min(ada.jumlah + it.jumlah, BATAS.jumlah);
      else items.push({ varian: it.varian, jumlah: it.jumlah, warna: warna });
    }
  }

  if (Object.keys(galat).length) return { ok: false, galat: galat };
  return { ok: true, data: { nama: nama, wa: wa, alamat: alamat, provinsi: provinsi, items: items } };
}

/**
 * Hitung pesanan dari data database.
 * sumber = {
 *   varian: { [id]: { id, kode, nama, harga, berat_kirim, stok, preorder, produk } },
 *   produk: { [id]: { id, kode, nama, aktif, warna: [nama…] } },
 *   zona:   [{ id, nama, provinsi: [...], tarif_per_kg, estimasi }]
 * }
 */
function hitungPesanan(data, sumber) {
  const masalah = [];
  const items = [];
  let subtotal = 0;
  let beratGram = 0;

  data.items.forEach(function (it) {
    const v = sumber.varian[it.varian];
    const p = v ? sumber.produk[v.produk] : null;
    if (!v || !p || !p.aktif) {
      masalah.push({ varian: it.varian, pesan: "Barang sudah tidak dijual." });
      return;
    }
    const label = p.nama + (v.nama ? " (" + v.nama + ")" : "");
    if (!v.preorder && v.stok <= 0) {
      masalah.push({ varian: it.varian, pesan: label + ": stok habis." });
      return;
    }
    if (!v.preorder && it.jumlah > v.stok) {
      masalah.push({ varian: it.varian, pesan: label + ": stok tinggal " + v.stok + "." });
      return;
    }
    let warna = null;
    if (p.warna && p.warna.length) {
      warna = it.warna && p.warna.indexOf(it.warna) >= 0 ? it.warna : null;
      if (!warna) {
        masalah.push({ varian: it.varian, pesan: label + ": pilih warna yang tersedia." });
        return;
      }
    }
    const sub = v.harga * it.jumlah;
    subtotal += sub;
    beratGram += v.berat_kirim * it.jumlah;
    items.push({
      varian: v.id, kode: v.kode, produk: p.kode, nama: p.nama, varian_nama: v.nama, warna: warna,
      harga: v.harga, jumlah: it.jumlah, berat_gram: v.berat_kirim, subtotal: sub, preorder: !!v.preorder,
    });
  });

  if (masalah.length) return { ok: false, masalah: masalah };

  const zona = sumber.zona.filter(function (z) { return (z.provinsi || []).indexOf(data.provinsi) >= 0; })[0] || null;
  const bayar = ongkir.ringkasBayar(subtotal, beratGram, zona ? { tarifPerKg: zona.tarif_per_kg } : null);

  return {
    ok: true,
    pesanan: {
      items: items,
      subtotal: subtotal,
      berat_gram: beratGram,
      berat_ditagih_kg: bayar.beratKg,
      ongkir: bayar.otomatis ? bayar.ongkir : 0,
      potongan_ongkir: bayar.otomatis ? bayar.potongan : 0,
      total: bayar.total,
      ongkir_konfirmasi: !bayar.otomatis,
      alasan_konfirmasi: bayar.otomatis ? "" : bayar.alasan,
      zona: zona ? { id: zona.id, nama: zona.nama, estimasi: zona.estimasi } : null,
    },
  };
}

const HURUF_NOMOR = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O dan 1/I supaya tidak tertukar

/** Nomor pesanan CS-YYMMDD-XXXX (tanggal WIB). acak: fungsi seperti Math.random. */
function buatNomor(waktuMs, acak) {
  const d = new Date(waktuMs + 7 * 3600 * 1000); // WIB, dibaca dengan getUTC*
  const dua = function (n) { return (n < 10 ? "0" : "") + n; };
  let akhir = "";
  for (let i = 0; i < 4; i++) akhir += HURUF_NOMOR.charAt(Math.floor(acak() * HURUF_NOMOR.length));
  return "CS-" + dua(d.getUTCFullYear() % 100) + dua(d.getUTCMonth() + 1) + dua(d.getUTCDate()) + "-" + akhir;
}

module.exports = { BATAS, normalisasiWA, validasiInput, hitungPesanan, buatNomor };
