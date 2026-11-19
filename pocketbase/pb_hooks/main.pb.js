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
    const jumlah = e.app.countRecords("varian", $dbx.hashExp({ produk: produk.id }));
    e.record.set("kode", `${produk.getString("kode")}-${jumlah + 1}`);
  }
  e.next();
}, "varian");
