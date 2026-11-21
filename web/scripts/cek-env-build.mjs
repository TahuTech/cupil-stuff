#!/usr/bin/env node
// Dijalankan sebelum `npm run build` (lihat package.json: "prebuild"). Cloudflare Pages memakai
// `npm run build`, jadi cek ini berjalan di sana: build GAGAL dengan pesan jelas bila variabel
// wajib produksi kosong. Nilai variabel tidak pernah dicetak, hanya namanya.
//
// BUILD_DEV=1 melewati cek (build lokal dengan PocketBase lokal).
// Logika sama dengan web/src/lib/cek-env.ts (dijaga oleh cek-env.test.ts).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const akar = join(dirname(fileURLToPath(import.meta.url)), "..");

const WAJIB = [
  ["PUBLIC_PB_URL", "Alamat API PocketBase, mis. https://api.cupilstuff.web.id", true],
  ["PUBLIC_SITE_URL", "Alamat katalog, mis. https://cupilstuff.web.id", true],
  ["PUBLIC_CDN_URL", "Alamat publik bucket R2, mis. https://cdn.cupilstuff.web.id (tanpa ini foto dan 3D bergantung ke homelab)", true],
  ["PUBLIC_QRIS_STATIS", "Teks QRIS statis toko (tanpa ini pembeli tidak bisa membayar)", false],
];

const polos = (v) => String(v ?? "").trim();

function bacaDotEnv() {
  const hasil = {};
  for (const nama of [".env", ".env.local"]) {
    try {
      for (const baris of readFileSync(join(akar, nama), "utf8").split("\n")) {
        const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && hasil[m[1]] === undefined) hasil[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      // berkas tidak ada: lewati
    }
  }
  return hasil;
}

const dev = process.env.BUILD_DEV === "1";
const env = { ...bacaDotEnv(), ...process.env };

const galat = [];
if (!dev) {
  for (const [nama, pesan, url] of WAJIB) {
    const v = polos(env[nama]);
    if (!v) {
      galat.push(`${nama} kosong — ${pesan}`);
      continue;
    }
    if (!url) continue;
    if (!/^https:\/\/[^/\s]+/.test(v)) galat.push(`${nama} harus diawali https:// (bukan http atau relatif)`);
    else if (/^https:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(v)) galat.push(`${nama} masih menunjuk localhost`);
  }
}

if (galat.length) {
  console.error("\n✗ Build produksi dibatalkan: variabel environment belum lengkap.\n");
  for (const g of galat) console.error(`  • ${g}`);
  console.error("\nIsi variabel di Cloudflare Pages → Settings → Environment variables");
  console.error("(lihat web/.env.example), lalu deploy ulang.");
  console.error("Build lokal tanpa variabel produksi: BUILD_DEV=1 npm run build\n");
  process.exit(1);
}

console.log(`✓ Variabel environment build OK${dev ? " (BUILD_DEV=1, cek dilewati)" : ""}.`);
