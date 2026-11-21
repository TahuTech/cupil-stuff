/// <reference path="../pb_data/types.d.ts" />

// Stok pesanan: berkurang saat status_bayar menjadi lunas, kembali saat lunas → batal/menunggu.
// Urutan: periksa semua varian dulu (tolak tanpa mengubah apa pun jika ada yang kurang),
// simpan pesanan, lalu ubah stok semua varian dalam satu transaksi.
// Logika di pesanan.stok.js (murni, punya unit test).

onRecordUpdate((e) => {
  const K = require(`${__hooks}/pesanan.stok.js`);
  const arah = K.arahStok(e.record.original().getString("status_bayar"), e.record.getString("status_bayar"));
  if (arah === 0) return e.next();

  let items = [];
  try {
    items = JSON.parse(e.record.getString("items") || "[]");
  } catch (_) {}

  const varian = {};
  for (const it of items) {
    if (!it || !it.varian || varian[it.varian]) continue;
    try {
      const v = e.app.findRecordById("varian", it.varian);
      varian[it.varian] = { stok: v.getInt("stok"), preorder: v.getBool("preorder") };
    } catch (_) {} // varian sudah dihapus
  }

  const rencana = K.rencanaStok(items, varian, arah);
  if (!rencana.ok) throw new BadRequestError("Stok tidak cukup: " + rencana.masalah.join("; ") + ". Status bayar tidak diubah.");

  e.next(); // simpan pesanan dulu

  e.app.runInTransaction((tx) => {
    for (const p of rencana.perubahan) {
      const v = tx.findRecordById("varian", p.id);
      v.set("stok", p.stok);
      tx.save(v);
    }
  });
  require(`${__hooks}/deploy.js`).triggerBuild();
}, "pesanan");
