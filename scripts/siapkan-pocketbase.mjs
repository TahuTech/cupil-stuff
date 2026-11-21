#!/usr/bin/env node
// Pengaturan PocketBase PRODUKSI sebagai kode (idempoten).
// Membaca env, lalu menulis settings lewat API admin PocketBase. Aman dijalankan berulang.
//
//   PB_EMAIL=... PB_PASSWORD=... node scripts/siapkan-pocketbase.mjs
//
// Env wajib: PB_EMAIL, PB_PASSWORD (superuser). Wajib di produksi: SITE_URL, API_URL.
// Env opsional: PB_URL, R2_*, SMTP_*, R2_BACKUP_BUCKET.
// Berkas .env di akar repo dibaca otomatis (env yang sudah ada di shell menang).
// Tidak pernah mencetak nilai rahasia (password, token, kunci) ke layar.
//
// Semua perubahan memakai PATCH sebagian (hanya bagian yang diatur). PocketBase tidak
// mengembalikan rahasia (password SMTP, secret S3) saat GET /api/settings, jadi mengirim balik
// seluruh objek hasil GET akan menimpa rahasia yang sudah tersimpan dengan kosong.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function muatDotEnv() {
  try {
    const akar = join(dirname(fileURLToPath(import.meta.url)), "..");
    for (const baris of readFileSync(join(akar, ".env"), "utf8").split("\n")) {
      const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // tidak ada .env: pakai env shell saja
  }
}
muatDotEnv();

const PB_URL = (process.env.PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
const E = process.env;

function wajib(nama) {
  const v = (E[nama] || "").trim();
  if (!v) {
    console.error(`\n✗ Env ${nama} kosong. Isi di .env homelab sebelum menjalankan skrip ini.`);
    console.error("  Lihat .env.example untuk daftar variabel produksi.\n");
    process.exit(1);
  }
  return v;
}

let token = "";

async function api(method, path, body) {
  const headers = { Authorization: token };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const teks = await res.text();
  const data = teks ? JSON.parse(teks) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data?.message || teks}`);
  return data;
}

const simpan = (bagian) => api("PATCH", "/api/settings", bagian);

/** Nama aplikasi + Application URL (+ alamat pengirim email bila SMTP_USER diisi). */
async function aturAplikasi() {
  const appUrl = wajib("API_URL");
  const meta = { appName: "Cupil Stuff", appURL: appUrl, senderName: "Cupil Stuff" };
  if ((E.SMTP_USER || "").trim()) meta.senderAddress = E.SMTP_USER.trim();
  await simpan({ meta });
  console.log(`✓ Application URL = ${appUrl}, nama aplikasi = Cupil Stuff`);
}

/** Trusted proxy: IP asli dibaca dari header CF-Connecting-IP (Cloudflare Tunnel). */
async function aturTrustedProxy() {
  await simpan({ trustedProxy: { headers: ["CF-Connecting-IP"], useLeftmostIP: false } });
  console.log("✓ Trusted proxy: IP asli dibaca dari header CF-Connecting-IP");
}

/** Peringatan email saat superuser login dari lokasi baru (butuh SMTP agar terkirim). */
async function aturPeringatanLogin() {
  await api("PATCH", "/api/collections/_superusers", { authAlert: { enabled: true } });
  console.log("✓ Peringatan login superuser aktif");
}

/** CORS hanya origin katalog. PocketBase v0.23+ memakai flag --origins, jadi ini sekadar cek. */
async function aturCors() {
  const situs = wajib("SITE_URL");
  const origins = (E.PB_ORIGINS || "").trim();
  if (!origins.includes(situs)) {
    console.log("✗ PB_ORIGINS belum memuat SITE_URL. Isi di .env homelab:");
    console.log(`  PB_ORIGINS=${situs},http://localhost:4321,http://127.0.0.1:4321`);
  } else {
    console.log(`✓ PB_ORIGINS memuat ${situs}`);
  }
}

/** S3/R2 untuk file. Endpoint, bucket, region auto, force path style. */
async function aturS3() {
  const endpoint = (E.R2_ENDPOINT || "").trim();
  const bucket = (E.R2_BUCKET || "").trim();
  const access = (E.R2_ACCESS_KEY_ID || "").trim();
  const secret = (E.R2_SECRET_ACCESS_KEY || "").trim();
  if (!endpoint || !bucket || !access || !secret) {
    console.log("ℹ R2_ENDPOINT/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY belum lengkap — S3 dilewati.");
    return;
  }
  await simpan({ s3: { enabled: true, bucket, region: "auto", endpoint, accessKey: access, secret, forcePathStyle: true } });
  console.log(`✓ S3/R2 aktif: bucket ${bucket}, region auto, force path style`);
}

/** Backup harian ke R2, simpan 7 terakhir. */
async function aturBackup() {
  const endpoint = (E.R2_ENDPOINT || "").trim();
  if (!endpoint || !(E.R2_BUCKET || "").trim()) {
    console.log("ℹ R2 belum diisi — backup ke S3 dilewati.");
    return;
  }
  const bucket = (E.R2_BACKUP_BUCKET || E.R2_BUCKET || "").trim();
  await simpan({
    backups: {
      cron: "0 2 * * *",
      cronMaxKeep: 7,
      s3: {
        enabled: true,
        bucket,
        region: "auto",
        endpoint,
        accessKey: (E.R2_ACCESS_KEY_ID || "").trim(),
        secret: (E.R2_SECRET_ACCESS_KEY || "").trim(),
        forcePathStyle: true,
      },
    },
  });
  console.log(`✓ Backup harian 02.00 ke ${bucket}, simpan 7 terakhir`);
}

/** SMTP dari env. Peringatan login superuser dari IP baru aktif dengan SMTP. */
async function aturSmtp() {
  const host = (E.SMTP_HOST || "").trim();
  if (!host) {
    console.log("ℹ SMTP_HOST kosong — SMTP dilewati (peringatan login tidak terkirim lewat email).");
    return;
  }
  const username = (E.SMTP_USER || "").trim();
  const port = Number(E.SMTP_PORT || 587);
  await simpan({
    smtp: {
      enabled: true,
      host,
      port,
      username,
      password: (E.SMTP_PASS || "").trim(),
      tls: String(E.SMTP_TLS || "true") !== "false",
      authMethod: username ? "PLAIN" : "",
    },
  });
  console.log(`✓ SMTP aktif ke ${host}:${port} (pengirim ${username || "-"})`);
}

async function main() {
  wajib("PB_EMAIL");
  wajib("PB_PASSWORD");
  wajib("API_URL");
  wajib("SITE_URL");

  const auth = await api("POST", "/api/collections/_superusers/auth-with-password", {
    identity: E.PB_EMAIL.trim(),
    password: E.PB_PASSWORD,
  });
  token = auth.token;
  console.log(`Login sebagai superuser di ${PB_URL}`);

  await aturAplikasi();
  await aturTrustedProxy();
  await aturCors();
  await aturS3();
  await aturBackup();
  await aturSmtp();
  await aturPeringatanLogin();
  console.log("\nSelesai. Periksa di panel admin (Settings), lalu jalankan scripts/cek-produksi.sh.");
}

main().catch((err) => {
  console.error("\n✗ Gagal:", err.message);
  process.exit(1);
});