/// <reference path="../pb_data/types.d.ts" />

// POST /api/ulasan: membuat ulasan dari link khusus (token di query ?t=TOKEN).
// - validasi token: ada, belum dipakai, belum kedaluwarsa (30 hari), dan record sumber
//   (pesanan status selesai/dikirim atau tiket status dikirim) masih layak.
// - ulasan tersimpan dengan status "menunggu" dan terverifikasi = true (karena dari link khusus).
// - token diisi ke field `token` supaya tidak bisa dipakai lagi (sekali pakai).
// Semua angka divalidasi di server; isian browser tidak dipercaya.
// createRule ulasan = null, jadi hanya route ini yang bisa membuat ulasan (selain panel admin).

routerAdd(
  "POST",
  "/api/ulasan",
  (e) => {
    const U = require(`${__hooks}/ulasan.js`);

    // batas per IP (kuota.js): 5 ulasan + 20 percobaan per jam
    const K = require(`${__hooks}/kuota.js`);
    const penuh = K.periksa(e, "ulasan");
    if (penuh) return e.json(penuh.status, penuh.body);

    // token dari query ?t=TOKEN (form mengirim token sebagai hidden input, tapi query lebih aman)
    let token = "";
    try {
      const q = e.requestInfo().query || {};
      if (q.t != null) token = String(q.t).trim();
    } catch (_) {}
    if (!token || !U.tokenWajar(token)) return e.json(400, { pesan: "Tautan ulasan tidak valid." });

    // cari record sumber (pesanan atau tiket) yang punya token_ulasan = token
    let sumber = null;
    let jenis = "";
    for (const koleksi of ["pesanan", "tiket_servis"]) {
      try {
        const r = e.app.findFirstRecordByData(koleksi, "token_ulasan", token);
        if (r) {
          sumber = r;
          jenis = koleksi === "pesanan" ? "produk" : "servis";
          break;
        }
      } catch (_) {}
    }
    if (!sumber) return e.json(404, { pesan: "Tautan ulasan tidak ditemukan atau sudah tidak berlaku." });

    // token kedaluwarsa (30 hari sejak record dibuat)
    if (U.tokenKedaluwarsa(sumber.getString("created"), Date.now())) {
      return e.json(410, { pesan: "Tautan ulasan sudah kedaluwarsa (berlaku 30 hari)." });
    }

    // token sekali pakai
    if (U.tokenTerpakai(e.app, token)) {
      return e.json(409, { pesan: "Ulasan untuk pesanan ini sudah pernah dikirim. Terima kasih!" });
    }

    // status sumber harus sudah layak: pesanan selesai/dikirim, tiket dikirim
    if (jenis === "produk") {
      const st = sumber.getString("status_kirim");
      if (st !== "dikirim" && st !== "selesai") {
        return e.json(409, { pesan: "Ulasan baru bisa ditulis setelah pesanan selesai atau dikirim." });
      }
    } else {
      if (sumber.getString("status") !== "dikirim") {
        return e.json(409, { pesan: "Ulasan baru bisa ditulis setelah perangkat dikirim balik." });
      }
    }

    // validasi isian
    let body = null;
    try {
      body = e.requestInfo().body;
    } catch (_) {}
    const v = U.validasiInput(body);
    if (!v.ok) return e.json(400, { pesan: "Periksa lagi isian kamu.", galat: v.galat });

    // foto: jumlah dan ukuran diperiksa sebelum menyimpan
    let daftarFoto = [];
    try {
      daftarFoto = e.findUploadedFiles("foto") || [];
    } catch (_) {
      daftarFoto = [];
    }
    const galatFoto = U.validasiFoto(daftarFoto.map((f) => ({ size: f.size })));
    if (galatFoto) return e.json(400, { pesan: "Periksa lagi isian kamu.", galat: { foto: galatFoto } });

    // relasi tujuan (produk dari item pesanan / jasa dari tiket)
    let produkId = null;
    let jasaId = null;
    if (jenis === "produk") {
      try {
        let items = [];
        try { items = JSON.parse(sumber.getString("items") || "[]"); } catch (_) {}
        // ulasan produk: pakai produk pertama di pesanan (form hanya untuk satu produk utama)
        if (items.length && items[0].produk) produkId = items[0].produk;
      } catch (_) {}
    } else {
      jasaId = sumber.getString("jasa") || null;
    }

    const r = new Record(e.app.findCollectionByNameOrId("ulasan"));
    r.set("jenis", jenis);
    if (produkId) r.set("produk", produkId);
    if (jasaId) r.set("jasa", jasaId);
    if (jenis === "produk") r.set("pesanan", sumber.id);
    else r.set("tiket", sumber.id);
    r.set("bintang", v.data.bintang);
    r.set("komentar", v.data.komentar);
    r.set("nama_tampil", v.data.nama_tampil);
    r.set("sumber", "situs");
    r.set("terverifikasi", true);
    r.set("token", token); // menandai token sudah dipakai
    r.set("status", "menunggu");
    r.set("izin_tampil", v.data.izin_tampil);
    if (daftarFoto.length) r.set("foto", daftarFoto);

    try {
      e.app.save(r);
    } catch (err) {
      // validasi field foto PocketBase memeriksa isi berkas (bukan nama): tolak yang bukan gambar
      if (String(err).indexOf("foto") >= 0) {
        return e.json(400, { pesan: "Periksa lagi isian kamu.", galat: { foto: "Foto harus berupa gambar JPG, PNG, atau WebP." } });
      }
      e.app.logger().error("Gagal menyimpan ulasan", "error", String(err));
      return e.json(500, { pesan: "Ulasan belum bisa disimpan. Coba lagi sebentar." });
    }

    K.catatDibuat(e, "ulasan");
    return e.json(200, { ok: true, pesan: "Terima kasih! Ulasanmu kami terima dan akan tampil setelah disetujui." });
  },
  $apis.bodyLimit(8 * 1024 * 1024), // sampai 3 foto + teks
);