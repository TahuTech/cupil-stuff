import { defineConfig } from "astro/config";

// Situs statis: data diambil dari PocketBase saat build,
// lalu Cloudflare Pages menyajikan file HTML hasil build.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://cupilstuff.example",
  output: "static",
  trailingSlash: "never",
});
