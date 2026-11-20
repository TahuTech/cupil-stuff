/// <reference path="../pb_data/types.d.ts" />
// Field `unggulan` di produk: ditampilkan di bagian "Produk pilihan" pada landing page (maks. 4).

migrate((app) => {
  const produk = app.findCollectionByNameOrId("produk");
  produk.fields.add(new BoolField({ name: "unggulan" }));
  app.save(produk);
}, (app) => {
  const produk = app.findCollectionByNameOrId("produk");
  produk.fields.removeByName("unggulan");
  app.save(produk);
});
