// Alamat route API PocketBase dari browser.
// - dev (`npm run dev`): relatif, diteruskan proxy Vite ke PocketBase lokal (astro.config.mjs),
//   jadi bisa dicoba dari HP lewat `npm run dev -- --host`
// - build: PUBLIC_PB_URL (mis. https://api.<domain>)
export function urlApi(jalur: string) {
  if (import.meta.env.DEV) return jalur;
  const pb = (import.meta.env.PUBLIC_PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
  return pb + jalur;
}
