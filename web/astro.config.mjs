import { defineConfig } from "astro/config";

// Situs statis: data diambil dari PocketBase saat build,
// lalu Cloudflare Pages menyajikan file HTML hasil build.
export default defineConfig({
  // alamat situs dari env (Cloudflare Pages: PUBLIC_SITE_URL); tidak ada domain tertulis di kode
  site: process.env.PUBLIC_SITE_URL || undefined,
  output: "static",
  trailingSlash: "never",
  // /katalog → katalog.html (bukan katalog/index.html), supaya Cloudflare Pages
  // menyajikan URL tanpa garis miring akhir tanpa redirect tambahan.
  build: { format: "file" },
  vite: {
    server: {
      // Saat dev, URL file relatif (/api/files/...) diteruskan ke PocketBase lokal.
      // PocketBase tetap hanya mendengarkan di 127.0.0.1; HP cukup mengakses dev server.
      proxy: { "/api": "http://127.0.0.1:8090" },
    },
  },
});
