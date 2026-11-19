/// <reference path="../pb_data/types.d.ts" />

// Build ulang katalog statis saat data yang tampil di katalog berubah.
const koleksiKatalog = ["kategori", "produk", "varian", "zona_ongkir", "jasa", "portofolio"];

onRecordAfterCreateSuccess((e) => {
  require(`${__hooks}/deploy.js`).triggerBuild();
  e.next();
}, ...koleksiKatalog);

onRecordAfterUpdateSuccess((e) => {
  require(`${__hooks}/deploy.js`).triggerBuild();
  e.next();
}, ...koleksiKatalog);

onRecordAfterDeleteSuccess((e) => {
  require(`${__hooks}/deploy.js`).triggerBuild();
  e.next();
}, ...koleksiKatalog);

// Kode varian otomatis jika dikosongkan: <kode produk>-<nomor urut>, misalnya EDC-001-2.
onRecordCreate((e) => {
  if (!e.record.getString("kode")) {
    const produk = e.app.findRecordById("produk", e.record.getString("produk"));
    const awalan = `${produk.getString("kode")}-`;
    // Pakai nomor terbesar + 1, bukan jumlah varian: setelah ada varian yang dihapus,
    // jumlah + 1 bisa sama dengan kode yang masih ada (kode varian harus unik).
    const lama = e.app.findRecordsByFilter("varian", "kode ~ {:awalan}", "", 0, 0, { awalan });
    let terbesar = 0;
    for (const v of lama) {
      const kode = v.getString("kode");
      if (!kode.startsWith(awalan)) continue;
      const n = Number(kode.slice(awalan.length));
      if (Number.isInteger(n) && n > terbesar) terbesar = n;
    }
    e.record.set("kode", `${awalan}${terbesar + 1}`);
  }
  e.next();
}, "varian");
