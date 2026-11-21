#!/usr/bin/env node
// Dijalankan sebelum `npm run build` (lihat package.json: "prebuild").
// Saat `npm run dev`/`astro build` lokal tidak dipanggil; Cloudflare Pages memakai `npm run build`
// sehingga cek ini berjalan di sana. Build produksi GAGAL dengan pesan jelas bila
// variabel wajib kosong.
//
// Env khusus: BUILD_DEV=1 untuk melewati cek (mis. build lokal dengan PocketBase lokal).
// Logika sama dengan web/src/lib/cek-env.ts (dijaga oleh cek-env.test.ts).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const akar = join(dirname(fileURLToPath(import.meta.url)), "..");

const WAJIB = [
  ["PUBLIC_PB_URL", "Alamat API PocketBase, mis. https://api.cupilstuff.web.id"],
  ["PUBLIC_SITE_URL", "Alamat katalog, mis. https://cupilstuff.web.id"],
];
const SARAN = [
  ["PUBLIC_CDN_URL", "Tanpa ini, foto dan 3D dimuat lewat PocketBase (lebih lambat, bergantung ke homelab)"],
  ["PUBLIC_QRIS_STATIS", "Tanpa ini, halaman pesanan tidak menampilkan QRIS"],
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

const dev = process.env.BUILD_DEV === "1" || process.env.npm_lifecycle_event === "dev";
const env = { ...bacaDotEnv(), ...process.env };

const galat = [];
const saran = [];

if (!dev) {
  for (const [nama, pesan] of WAJIB) {
    if (!polos(env[nama])) galat.push(`${nama} kosong — ${pesan}`);
  }
  for (const nama of ["PUBLIC_PB_URL", "PUBLIC_SITE_URL"]) {
    const v = polos(env[nama]);
    if (!v) continue;
    if (!/^https:\/\/[^/\s]+/.test(v)) galat.push(`${nama} harus diawali https:// (bukan http atau relatif): "${v}"`);
    else if (/^https:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(v)) galat.push(`${nama} masih menunjuk localhost: "${v}"`);
  }
  for (const [nama, pesan] of SARAN) {
    if (!polos(env[nama])) saran.push(`${nama} kosong — ${pesan}`);
  }
}

if (saran.length) {
  console.log("\n⚠ Saran (tidak menggagalkan build):");
  for (const s of saran) console.log(`  • ${s}`);
  console.log("");
}

if (galat.length) {
  console.error("\n✗ Build produksi dibatalkan: variabel environment belum lengkap.\n");
  for (const g of galat) console.error(`  • ${g}`);
  console.error("\nIsi variabel di Cloudflare Pages → Settings → Environment variables");
  console.error("(lihat web/.env.example), lalu deploy ulang.\n");
  process.exit(1);
}

console.log(`✓ Variabel environment build OK${dev ? " (mode dev, cek dilewati)" : ""}.`);
