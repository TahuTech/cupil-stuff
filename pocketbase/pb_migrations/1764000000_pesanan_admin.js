/// <reference path="../pb_data/types.d.ts" />
// Tahap 4: field tambahan untuk alur pemilik toko setelah pesanan masuk.
// - link_wa_ongkir: URL WhatsApp untuk mengirim info ongkir ke pembeli
// - link_wa_lunas: URL WhatsApp untuk konfirmasi pembayaran diterima
// - link_wa_resi: URL WhatsApp untuk mengirim info resi ke pembeli

migrate((app) => {
  const c = app.findCollectionByNameOrId("pesanan");
  c.fields.add(new TextField({ name: "link_wa_ongkir" }));
  c.fields.add(new TextField({ name: "link_wa_lunas" }));
  c.fields.add(new TextField({ name: "link_wa_resi" }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("pesanan");
  c.fields.removeByName("link_wa_ongkir");
  c.fields.removeByName("link_wa_lunas");
  c.fields.removeByName("link_wa_resi");
  app.save(c);
});