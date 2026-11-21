/// <reference path="../pb_data/types.d.ts" />
// Tiket servis: data untuk ongkir kirim balik, tagihan, dan link WhatsApp pemilik toko.
// - perangkat_jenis: mouse/keyboard/lainnya → berat bawaan kirim balik (pb_hooks/servis.js)
// - resi: resi J&T kirim balik
// - total_tagihan: dihitung otomatis (tiket.hitung.pb.js) dari biaya + ongkir kirim balik
// - link_wa_*: URL WhatsApp terhitung untuk mengabari pembeli (pola sama dengan pesanan, tahap 4)

migrate((app) => {
  const c = app.findCollectionByNameOrId("tiket_servis");
  c.fields.add(new SelectField({ name: "perangkat_jenis", maxSelect: 1, values: ["mouse", "keyboard", "lainnya"] }));
  c.fields.add(new TextField({ name: "resi", max: 40 }));
  c.fields.add(new NumberField({ name: "total_tagihan", onlyInt: true, min: 0 }));
  for (const nama of ["link_wa_diterima", "link_wa_estimasi", "link_wa_selesai", "link_wa_resi"]) {
    c.fields.add(new URLField({ name: nama }));
  }
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("tiket_servis");
  for (const nama of ["perangkat_jenis", "resi", "total_tagihan", "link_wa_diterima", "link_wa_estimasi", "link_wa_selesai", "link_wa_resi"]) {
    c.fields.removeByName(nama);
  }
  app.save(c);
});
