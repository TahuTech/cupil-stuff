// Rencana perubahan stok saat status bayar pesanan berubah (murni, diuji di
// web/src/lib/pesanan-stok-hook.test.ts; diterapkan oleh pesanan.stok.pb.js).
//
// - menjadi "lunas": kurangi stok setiap varian
// - dari "lunas" ke status lain (batal/menunggu): kembalikan stok
// - varian pre-order tidak ditolak walau stok kurang; stok tidak pernah di bawah 0
// - jika SATU varian kurang stok, TIDAK ADA yang diubah (semua atau tidak sama sekali)

/** Arah perubahan: -1 kurangi, +1 kembalikan, 0 tidak ada. */
function arahStok(statusLama, statusBaru) {
  if (statusLama === statusBaru) return 0;
  if (statusBaru === "lunas") return -1;
  if (statusLama === "lunas") return 1;
  return 0;
}

/**
 * items: [{ varian, jumlah, nama }] dari pesanan
 * varian: { [id]: { stok, preorder, kode } } dari database (varian yang sudah dihapus tidak ada)
 * Hasil: { ok: true, perubahan: [{ id, stok }] } atau { ok: false, masalah: [teks] }
 */
function rencanaStok(items, varian, arah) {
  const total = {}; // jumlah per varian (pesanan bisa punya varian sama dengan warna berbeda)
  const nama = {};
  (items || []).forEach(function (it) {
    if (!it || !it.varian || !(it.jumlah > 0)) return;
    total[it.varian] = (total[it.varian] || 0) + it.jumlah;
    nama[it.varian] = it.nama || it.kode || it.varian;
  });

  const perubahan = [];
  const masalah = [];
  Object.keys(total).forEach(function (id) {
    const v = varian[id];
    if (!v) return; // varian sudah dihapus: lewati
    const baru = v.stok + arah * total[id];
    if (arah < 0 && baru < 0 && !v.preorder) {
      masalah.push(nama[id] + ": stok tinggal " + v.stok + ", butuh " + total[id]);
      return;
    }
    perubahan.push({ id: id, stok: Math.max(0, baru) });
  });
  if (masalah.length) return { ok: false, masalah: masalah };
  return { ok: true, perubahan: perubahan };
}

module.exports = { arahStok, rencanaStok };
