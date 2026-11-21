// Notifikasi ke pemilik toko lewat bot Telegram (gratis).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (keduanya wajib; jika kosong dilewati diam-diam),
//      API_URL (alamat PocketBase publik, untuk link ke panel admin; opsional).
// Pembuatan pesan murni dan diuji di web/src/lib/telegram-hook.test.ts.
// kirim() tidak pernah melempar galat: kegagalan hanya dicatat di log PocketBase.

const B = require((typeof __hooks !== "undefined" ? __hooks : __dirname) + "/bersama.js");

/** Link ke record di panel admin PocketBase, atau "" jika API_URL belum diisi. */
function linkAdmin(apiUrl, koleksi, id) {
  if (!apiUrl) return "";
  return apiUrl.replace(/\/+$/, "") + "/_/#/collections?collection=" + encodeURIComponent(koleksi) + "&record=" + encodeURIComponent(id);
}

/** p: { id, nomor, total, jumlah_barang, ongkir_konfirmasi, alasan, provinsi } */
function pesanPesanan(p, apiUrl) {
  const baris = [];
  if (p.ongkir_konfirmasi) {
    baris.push("⚠️ Pesanan baru " + p.nomor + " — ongkir perlu dikonfirmasi");
    baris.push("Total barang: " + B.rp(p.total) + " (" + p.jumlah_barang + " barang), ke " + p.provinsi);
    baris.push(p.alasan || "Isi ongkir manual di panel admin.");
  } else {
    baris.push("🛒 Pesanan baru " + p.nomor);
    baris.push("Total: " + B.rp(p.total) + " (" + p.jumlah_barang + " barang), ke " + p.provinsi);
  }
  const link = linkAdmin(apiUrl, "pesanan", p.id);
  if (link) baris.push(link);
  return baris.join("\n");
}

/** t: { id, nomor, jasa, perangkat_jenis, perangkat, cara_kirim } */
function pesanTiket(t, apiUrl) {
  const baris = [
    "🔧 Tiket servis baru " + t.nomor,
    "Jasa: " + (t.jasa || "belum dipilih"),
    "Perangkat: " + [t.perangkat_jenis, t.perangkat].filter(Boolean).join(", "),
    "Cara kirim: " + (t.cara_kirim === "antar" ? "antar langsung" : "kurir"),
  ];
  const link = linkAdmin(apiUrl, "tiket_servis", t.id);
  if (link) baris.push(link);
  return baris.join("\n");
}

/** Kirim pesan. Hasil true jika terkirim; false jika dilewati atau gagal (tanpa melempar galat). */
function kirim(teks) {
  try {
    const token = String($os.getenv("TELEGRAM_BOT_TOKEN") || "").trim();
    const chat = String($os.getenv("TELEGRAM_CHAT_ID") || "").trim();
    if (!token || !chat) return false;
    const dasar = String($os.getenv("TELEGRAM_API_URL") || "https://api.telegram.org").replace(/\/+$/, "");
    const res = $http.send({
      url: dasar + "/bot" + token + "/sendMessage",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: teks, disable_web_page_preview: true }),
      timeout: 5, // detik; pesanan tetap tersimpan walau Telegram lambat atau mati
    });
    if (res.statusCode !== 200) {
      $app.logger().warn("Notifikasi Telegram gagal", "status", res.statusCode);
      return false;
    }
    return true;
  } catch (err) {
    try { $app.logger().warn("Notifikasi Telegram gagal", "error", String(err)); } catch (_) {}
    return false;
  }
}

module.exports = { linkAdmin, pesanPesanan, pesanTiket, kirim };
