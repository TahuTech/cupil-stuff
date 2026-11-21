/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// Hook stok pesanan
// - Saat status_bayar berubah menjadi lunas: kurangi stok setiap varian
// - Saat lunas → batal: kembalikan stok
// - Varian pre-order tidak membatasi stok di bawah 0
// - Perubahan stok memicu build ulang katalog
// =============================================================================

onRecordUpdate((e) => {
  var baru = e.record.getString("status_bayar");

  // Cek status sebelumnya
  var statusLama = "";
  try {
    var lama = e.app.findRecordById("pesanan", e.record.id);
    statusLama = lama.getString("status_bayar");
  } catch (err) { e.next(); return; }

  // Hanya tangani perubahan ke/dari lunas
  if (baru === statusLama) { e.next(); return; }
  if (baru !== "lunas" && statusLama !== "lunas") { e.next(); return; }

  var itemsStr = e.record.getString("items");
  if (!itemsStr) { e.next(); return; }
  var items = JSON.parse(itemsStr);
  if (!Array.isArray(items) || items.length === 0) { e.next(); return; }

  var arah = baru === "lunas" ? -1 : 1; // -1 kurangi, +1 kembalikan
  var masalah = [];

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!it.varian || !it.jumlah) continue;
    try {
      var v = e.app.findRecordById("varian", it.varian);
      var stokSekarang = v.getInt("stok");
      var preorder = v.getBool("preorder");
      var stokBaru = stokSekarang + arah * it.jumlah;

      if (arah === -1 && !preorder && stokBaru < 0) {
        var kode = v.getString("kode") || it.varian;
        var nama = it.nama || kode;
        masalah.push(nama + ": stok tinggal " + stokSekarang + ", butuh " + it.jumlah);
        continue;
      }

      v.set("stok", stokBaru);
      e.app.save(v);
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
    }
  }

  if (masalah.length > 0) {
    throw new BadRequestError("Stok tidak cukup: " + masalah.join("; "));
  }

  require(__hooks + "/deploy.js").triggerBuild();
  e.next();
}, "pesanan");