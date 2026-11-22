/// <reference path="../pb_data/types.d.ts" />
// Sembunyikan field privat pada koleksi ulasan dari respons API (termasuk publik).
// `hidden` = field tidak pernah diserialisasi ke respons API, tapi tetap tersimpan & bisa
// diedit di panel admin. Tujuannya: walaupun listRule = "status = 'tampil'", respons API
// publik TIDAK PERNAH memuat relasi pesanan/tiket asal maupun token (tautan sekali-pakai).
// Build halaman statis tetap bisa membaca ulasan tampil (listRule tetap), hanya field tampilan
// yang dikirim (lihat FIELD_ULASAN di web/src/lib/pb.ts).

migrate((app) => {
  const ulasan = app.findCollectionByNameOrId("ulasan");
  for (const nama of ["pesanan", "tiket", "token"]) {
    const f = ulasan.fields.getByName(nama);
    if (f) f.hidden = true;
  }
  app.save(ulasan);
}, (app) => {
  const ulasan = app.findCollectionByNameOrId("ulasan");
  for (const nama of ["pesanan", "tiket", "token"]) {
    const f = ulasan.fields.getByName(nama);
    if (f) f.hidden = false;
  }
  app.save(ulasan);
});