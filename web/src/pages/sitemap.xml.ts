import type { APIRoute } from "astro";

// Daftar halaman statis yang boleh di-index.
const HALAMAN = [
  "/",
  "/katalog",
  "/servis",
  "/servis/mouse",
  "/servis/keyboard",
  "/servis/joystick-controller",
  "/hasil-servis",
  "/cek-tiket",
  "/bayar",
  "/faq",
];

export const GET: APIRoute = async () => {
  const site = (import.meta.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  let jalan = [...HALAMAN];

  // Tambahkan halaman produk bila katalog tersedia (dev: data contoh; produksi: data asli).
  try {
    const { ambilKatalog } = await import("../lib/pb");
    const { produk } = await ambilKatalog();
    jalan = [...jalan, ...produk.map((p) => `/produk/${p.kode}`)];
  } catch {
    // build tanpa PocketBase → cukup halaman statis.
  }

  const urlEncode = (s: string) => s.split("&").join("&amp;").split("<").join("&lt;");
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...new Set(jalan)].map(
      (j) =>
        `  <url><loc>${urlEncode(`${site}${j}`)}</loc><changefreq>monthly</changefreq></url>`,
    ),
    "</urlset>",
  ].join("\n");

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};