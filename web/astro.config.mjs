import { defineConfig } from "astro/config";

// Situs statis: data diambil dari PocketBase saat build,
// lalu Cloudflare Pages menyajikan file HTML hasil build.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://cupilstuff.example",
  output: "static",
  trailingSlash: "never",
  vite: {
    server: {
      // Saat dev, URL file relatif (/api/files/...) diteruskan ke PocketBase lokal.
      // PocketBase tetap hanya mendengarkan di 127.0.0.1; HP cukup mengakses dev server.
      proxy: { "/api": "http://127.0.0.1:8090" },
    },
  },
});
