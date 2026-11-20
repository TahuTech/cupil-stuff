/// <reference path="../pb_data/types.d.ts" />
// Field tambahan untuk checkout (tahap 3):
// - berat_gram: total berat kirim sebelum dibulatkan
// - ongkir_konfirmasi: true jika ongkir tidak dihitung otomatis (di atas 5 kg atau zona tidak ditemukan)

migrate((app) => {
  const c = app.findCollectionByNameOrId("pesanan");
  c.fields.add(new NumberField({ name: "berat_gram", onlyInt: true, min: 0 }));
  c.fields.add(new BoolField({ name: "ongkir_konfirmasi" }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("pesanan");
  c.fields.removeByName("berat_gram");
  c.fields.removeByName("ongkir_konfirmasi");
  app.save(c);
});
