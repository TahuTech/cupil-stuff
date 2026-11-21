/// <reference path="../pb_data/types.d.ts" />

// POST /api/servis: membuat tiket servis.
// Body: multipart/form-data — nama, wa, perangkat_jenis, perangkat, keluhan, cara_kirim,
//       provinsi (wajib jika kurir), jasa (opsional), foto[] (maks 5, masing-masing maks 5 MB). Validasi di server; nomor tiket SRV-YYMMDD-XXXX, status menunggu_perangkat.
// createRule tiket_servis = null, jadi hanya route ini yang bisa membuat tiket.
routerAdd(
  "POST",
  "/api/servis",
  (e) => {
    const S = require(`${__hooks}/servis.js`);

    // batas per IP (kuota.js): 10 tiket dibuat + 30 percobaan per jam
    const K = require(`${__hooks}/kuota.js`);
    const penuh = K.periksa(e, "servis");
    if (penuh) return e.json(penuh.status, penuh.body);

    const info = e.requestInfo();
    const body = info.body || {};

    const v = S.validasiInput(body);
    if (!v.ok) return e.json(400, { pesan: "Periksa lagi isian kamu.", galat: v.galat });

    // foto: jumlah dan ukuran diperiksa sebelum menyimpan apa pun
    let daftarFoto = [];
    try {
      daftarFoto = e.findUploadedFiles("foto") || [];
    } catch (_) {
      daftarFoto = [];
    }
    const galatFoto = S.validasiFoto(daftarFoto.map((f) => ({ size: f.size })));
    if (galatFoto) return e.json(400, { pesan: "Periksa lagi isian kamu.", galat: { foto: galatFoto } });

    // cek jasa (jika dipilih) memang aktif
    let jasaId = v.data.jasa;
    if (jasaId) {
      try {
        const rj = e.app.findRecordById("jasa", jasaId);
        if (!rj.getBool("aktif")) jasaId = null;
      } catch (_) {
        jasaId = null;
      }
    }

    // nomor tiket unik SRV-YYMMDD-XXXX
    let nomor = "";
    for (let i = 0; i < 10; i++) {
      const calon = S.buatNomor(Date.now(), Math.random);
      try {
        e.app.findFirstRecordByData("tiket_servis", "nomor", calon);
      } catch (_) {
        nomor = calon;
        break;
      }
    }
    if (!nomor) return e.json(503, { pesan: "Gagal membuat nomor tiket. Coba lagi sebentar." });

    const r = new Record(e.app.findCollectionByNameOrId("tiket_servis"));
    r.set("nomor", nomor);
    r.set("nama", v.data.nama);
    r.set("wa", v.data.wa);
    r.set("perangkat", v.data.perangkat);
    r.set("keluhan", v.data.keluhan);
    r.set("cara_kirim", v.data.cara_kirim);
    r.set("perangkat_jenis", v.data.perangkat_jenis);
    r.set("provinsi", v.data.provinsi);
    if (jasaId) r.set("jasa", jasaId);
    r.set("status", "menunggu_perangkat");
    r.set("status_bayar", "belum");

    // semua foto sekaligus (set berulang hanya menyimpan foto terakhir)
    if (daftarFoto.length) r.set("foto", daftarFoto);

    try {
      e.app.save(r);
    } catch (err) {
      // validasi field foto PocketBase memeriksa isi berkas (bukan nama): tolak yang bukan gambar
      if (String(err).indexOf("foto") >= 0) {
        return e.json(400, { pesan: "Periksa lagi isian kamu.", galat: { foto: "Foto harus berupa gambar JPG, PNG, atau WebP." } });
      }
      e.app.logger().error("Gagal menyimpan tiket servis", "error", String(err));
      return e.json(500, { pesan: "Tiket belum bisa dibuat. Coba lagi sebentar." });
    }

    K.catatDibuat(e, "servis");
    return e.json(200, { nomor, status: "menunggu_perangkat" });
  },
  $apis.bodyLimit(8 * 1024 * 1024), // sampai 5 foto kecil + teks
);