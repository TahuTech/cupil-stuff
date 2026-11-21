/// <reference path="../pb_data/types.d.ts" />
// Tiket servis: status pembayaran tagihan (diisi pemilik toko) + link konfirmasi lunas.
// Tiket lama tanpa status_bayar dianggap "belum".

migrate((app) => {
  const c = app.findCollectionByNameOrId("tiket_servis");
  c.fields.add(new SelectField({ name: "status_bayar", maxSelect: 1, values: ["belum", "lunas"] }));
  c.fields.add(new URLField({ name: "link_wa_lunas" }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("tiket_servis");
  c.fields.removeByName("status_bayar");
  c.fields.removeByName("link_wa_lunas");
  app.save(c);
});
