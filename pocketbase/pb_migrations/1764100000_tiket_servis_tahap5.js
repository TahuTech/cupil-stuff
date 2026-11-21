/// <reference path="../pb_data/types.d.ts" />
// Tahap 5: field tambahan untuk tiket servis.
// - provinsi: tujuan kirim balik, untuk hitung ongkir kirim balik memakai zona yang sama
// - ongkir_kirim_balik: ongkir kirim balik (diisi admin saat batal/selesai)

migrate((app) => {
  const c = app.findCollectionByNameOrId("tiket_servis");
  c.fields.add(new TextField({ name: "provinsi" }));
  c.fields.add(new NumberField({ name: "ongkir_kirim_balik", onlyInt: true, min: 0 }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("tiket_servis");
  c.fields.removeByName("provinsi");
  c.fields.removeByName("ongkir_kirim_balik");
  app.save(c);
});