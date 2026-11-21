/// <reference path="../pb_data/types.d.ts" />

// POST /api/checkout: membuat pesanan. Semua angka dihitung ulang di server
// (lihat pesanan.js); angka dari browser diabaikan.
// Body: { items: [{ varian, jumlah, warna }], nama, wa, alamat, provinsi }
routerAdd(
  "POST",
  "/api/checkout",
  (e) => {
    const P = require(`${__hooks}/pesanan.js`);

    // batas per IP (kuota.js): 10 pesanan dibuat + 30 percobaan per jam
    const K = require(`${__hooks}/kuota.js`);
    const penuh = K.periksa(e, "checkout");
    if (penuh) return e.json(penuh.status, penuh.body);

    // JSON field dibaca lewat getString lalu JSON.parse
    const bacaJSON = (rec, field) => {
      try {
        const s = rec.getString(field);
        return s ? JSON.parse(s) : null;
      } catch (_) {
        return null;
      }
    };

    let body = null;
    try {
      body = e.requestInfo().body;
    } catch (_) {}
    const v = P.validasiInput(body);
    if (!v.ok) return e.json(400, { pesan: "Periksa lagi isian kamu.", galat: v.galat });

    // ambil data varian, produk, dan zona dari database
    const sumber = { varian: {}, produk: {}, zona: [] };
    for (const it of v.data.items) {
      let rv;
      try {
        rv = e.app.findRecordById("varian", it.varian);
      } catch (_) {
        continue; // tidak ada → ditandai "sudah tidak dijual" oleh hitungPesanan
      }
      const idProduk = rv.getString("produk");
      sumber.varian[rv.id] = {
        id: rv.id,
        kode: rv.getString("kode"),
        nama: rv.getString("nama"),
        harga: rv.getInt("harga"),
        berat_kirim: rv.getInt("berat_kirim"),
        stok: rv.getInt("stok"),
        preorder: rv.getBool("preorder"),
        produk: idProduk,
      };
      if (!sumber.produk[idProduk]) {
        try {
          const rp = e.app.findRecordById("produk", idProduk);
          const warna = bacaJSON(rp, "warna");
          sumber.produk[idProduk] = {
            id: rp.id,
            kode: rp.getString("kode"),
            nama: rp.getString("nama"),
            aktif: rp.getBool("aktif"),
            warna: Array.isArray(warna) ? warna.map((w) => w && w.nama).filter(Boolean) : [],
          };
        } catch (_) {}
      }
    }
    for (const z of e.app.findAllRecords("zona_ongkir")) {
      sumber.zona.push({
        id: z.id,
        nama: z.getString("nama"),
        provinsi: bacaJSON(z, "provinsi") || [],
        tarif_per_kg: z.getInt("tarif_per_kg"),
        estimasi: z.getString("estimasi"),
      });
    }

    const h = P.hitungPesanan(v.data, sumber);
    if (!h.ok) {
      return e.json(409, { pesan: "Ada barang yang berubah. Periksa lagi keranjangmu.", masalah: h.masalah });
    }
    const ps = h.pesanan;

    // nomor unik CS-YYMMDD-XXXX
    let nomor = "";
    for (let i = 0; i < 10; i++) {
      const calon = P.buatNomor(Date.now(), Math.random);
      try {
        e.app.findFirstRecordByData("pesanan", "nomor", calon);
      } catch (_) {
        nomor = calon; // belum dipakai
        break;
      }
    }
    if (!nomor) return e.json(503, { pesan: "Gagal membuat nomor pesanan. Coba lagi sebentar." });

    const r = new Record(e.app.findCollectionByNameOrId("pesanan"));
    r.set("nomor", nomor);
    r.set("items", ps.items);
    r.set("pembeli", v.data.nama);
    r.set("wa", v.data.wa);
    r.set("alamat", v.data.alamat);
    r.set("provinsi", v.data.provinsi);
    if (ps.zona) r.set("zona", ps.zona.id);
    r.set("berat_gram", ps.berat_gram);
    r.set("berat_ditagih_kg", ps.berat_ditagih_kg);
    r.set("subtotal", ps.subtotal);
    r.set("ongkir", ps.ongkir);
    r.set("potongan_ongkir", ps.potongan_ongkir);
    r.set("total", ps.total);
    r.set("ongkir_konfirmasi", ps.ongkir_konfirmasi);
    r.set("status_bayar", "menunggu");
    e.app.save(r);
    K.catatDibuat(e, "checkout");

    return e.json(200, {
      nomor,
      items: ps.items.map((x) => ({
        kode: x.kode, nama: x.nama, varian_nama: x.varian_nama, warna: x.warna,
        harga: x.harga, jumlah: x.jumlah, subtotal: x.subtotal,
      })),
      subtotal: ps.subtotal,
      berat_ditagih_kg: ps.berat_ditagih_kg,
      ongkir: ps.ongkir,
      potongan_ongkir: ps.potongan_ongkir,
      total: ps.total,
      ongkir_konfirmasi: ps.ongkir_konfirmasi,
      alasan_konfirmasi: ps.alasan_konfirmasi,
      zona: ps.zona ? { nama: ps.zona.nama, estimasi: ps.zona.estimasi } : null,
      provinsi: v.data.provinsi,
    });
  },
  $apis.bodyLimit(16 * 1024), // isian checkout kecil; tolak body besar
);
