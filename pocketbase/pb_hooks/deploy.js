// Dipanggil dari main.pb.js lewat require(); handler PocketBase berjalan terpisah,
// jadi fungsi bersama harus ada di modul seperti ini.
module.exports = {
  // Memicu build ulang katalog di Cloudflare Pages.
  // Jeda 60 detik: beberapa perubahan beruntun cukup memicu satu build.
  triggerBuild() {
    const url = $os.getenv("PAGES_DEPLOY_HOOK");
    if (!url) return;

    const now = Date.now();
    const last = Number($app.store().get("lastDeployHook") || 0);
    if (now - last < 60 * 1000) return;
    $app.store().set("lastDeployHook", now);

    try {
      $http.send({ url, method: "POST", timeout: 15 });
    } catch (err) {
      $app.logger().error("Deploy hook gagal", "error", String(err));
    }
  },
};
