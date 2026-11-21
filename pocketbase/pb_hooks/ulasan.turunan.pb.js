/// <reference path="../pb_data/types.d.ts" />

// Tautan ulasan hanya berlaku selama record masih layak diulas:
// - pesanan: status_kirim "dikirim" atau "selesai"
// - tiket_servis: status "dikirim"
// Hook ini mengosongkan token_ulasan saat record keluar dari status layak (mis. pesanan
// dikembalikan ke "diproses" atau tiket diubah), supaya tautan lama tidak bisa dipakai.
// Dibuat setelah tahap ulasan; tidak mengganggu alur checkout/servis.

onRecordUpdate((e) => {
  const koleksi = e.record.collection().name;
  if (koleksi === "pesanan") {
    const layak = ["dikirim", "selesai"].indexOf(e.record.getString("status_kirim")) >= 0;
    if (!layak && e.record.getString("token_ulasan")) e.record.set("token_ulasan", "");
  } else if (koleksi === "tiket_servis") {
    if (e.record.getString("status") !== "dikirim" && e.record.getString("token_ulasan")) {
      e.record.set("token_ulasan", "");
    }
  }
  e.next();
}, "pesanan", "tiket_servis");