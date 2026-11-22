/// <reference path="../pb_data/types.d.ts" />

// Setiap kali pesanan dibuat atau diubah:
// - ongkir diisi manual (pesanan butuh konfirmasi ongkir) → hitung ulang potongan + total
// - link_wa_ongkir / link_wa_lunas / link_wa_resi dihitung ulang dari data terbaru
// - token_ulasan + link_wa_ulasan (untuk meminta ulasan) dihitung saat pesanan layak diulas
// Logika di pesanan.wa.js + ulasan.wa.js (murni, punya unit test). Fungsi harus di-require DI DALAM
// handler: handler PocketBase berjalan terpisah dan tidak bisa membaca fungsi di luar handler.

onRecordCreate((e) => {
  require(`${__hooks}/pesanan.wa.turunan.js`).isi(e.record);
  e.next();
}, "pesanan");

onRecordUpdate((e) => {
  require(`${__hooks}/pesanan.wa.turunan.js`).isi(e.record);
  e.next();
}, "pesanan");