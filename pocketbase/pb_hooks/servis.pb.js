/// <reference path="../pb_data/types.d.ts" />

// POST /api/servis: membuat tiket servis.
// Body: multipart/form-data — nama, wa, perangkat, keluhan, cara_kirim, provinsi, jasa (opsional),
//       foto[] (maks 5). Validasi di server; nomor tiket SRV-YYMMDD-XXXX, status menunggu_perangkat.
// createRule tiket_servis = null, jadi hanya route ini yang bisa membuat tiket.
routerAdd(
  "POST",
  "/api/servis",
  (e) => {
    const S = require(`${__hooks}/servis.js`);

    const info = e.requestInfo();
    const body = info.body || {};

    const v = S.validasiInput(body);
    if (!v.ok) return e.json(400, { pesan: "Periksa lagi isian kamu.", galat: v.galat });

    // provinsi (opsional di validasi dasar, tapi dipakai untuk ongkir kirim balik)
    const provinsi = typeof body.provinsi === "string" ? body.provinsi.replace(/\s+/g, " ").trim() : "";

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
    r.set("provinsi", provinsi);
    if (jasaId) r.set("jasa", jasaId);
    r.set("status", "menunggu_perangkat");

    // foto: multipart files, maks 5, sudah dikecilkan di browser
    let daftarFoto = [];
    try {
      daftarFoto = e.findUploadedFiles("foto") || [];
    } catch (_) {
      daftarFoto = [];
    }
    let n = 0;
    for (const f of daftarFoto) {
      if (!f || n >= 5) continue;
      try {
        r.set("foto", f); // file field maxSelect 5, PocketBase menumpuk
        n++;
      } catch (_) {}
    }

    try {
      e.app.save(r);
    } catch (err) {
      return e.json(400, { pesan: "Tiket tidak bisa dibuat. Periksa foto atau coba lagi.", rinci: String(err) });
    }

    return e.json(200, { nomor, status: "menunggu_perangkat" });
  },
  $apis.bodyLimit(8 * 1024 * 1024), // sampai 5 foto kecil + teks
);