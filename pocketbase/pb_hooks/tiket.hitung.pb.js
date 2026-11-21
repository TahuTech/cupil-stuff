/// <reference path="../pb_data/types.d.ts" />

// Setiap kali tiket servis dibuat atau diubah (lewat route atau panel admin), hitung ulang:
// - ongkir_kirim_balik: jika tiket baru, atau cara kirim / provinsi / jenis perangkat berubah.
//   Di luar itu nilai yang diisi pemilik toko secara manual dipertahankan.
// - total_tagihan: dari biaya_final (atau estimasi_biaya) + ongkir kirim balik, sesuai status
// - link_wa_*: link WhatsApp untuk mengabari pembeli
// Logika ada di servis.js (murni, punya unit test).

onRecordCreate((e) => {
  require(`${__hooks}/tiket.turunan.js`).isiTurunan(e.app, e.record, true);
  e.next();
}, "tiket_servis");

onRecordUpdate((e) => {
  require(`${__hooks}/tiket.turunan.js`).isiTurunan(e.app, e.record, false);
  e.next();
}, "tiket_servis");
