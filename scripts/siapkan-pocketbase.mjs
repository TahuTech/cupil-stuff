#!/usr/bin/env node
// Pengaturan PocketBase PRODUKSI sebagai kode (idempoten).
// Membaca env, lalu menulis settings lewat API admin PocketBase. Aman dijalankan berulang.
//
//   PB_EMAIL=... PB_PASSWORD=... node scripts/siapkan-pocketbase.mjs
//
// Env wajib: PB_EMAIL, PB_PASSWORD (superuser). Wajib di produksi: SITE_URL, API_URL.
// Env opsional: PB_URL, R2_*, SMTP_*, R2_BACKUP_BUCKET.
// Tidak pernah mencetak nilai rahasia (password, token, kunci) ke layar.

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

const ambil = () => api("GET", "/api/settings");
const simpan = (s) => api("PATCH", "/api/settings", s);

/** Nama aplikasi + Application URL. */
async function aturAplikasi() {
  const s = await ambil();
  const appUrl = wajib("API_URL");
  s.meta.appName = "Cupil Stuff";
  s.meta.appURL = appUrl;
  if ((E.SMTP_USER || "").trim()) s.meta.senderAddress = E.SMTP_USER.trim();
  await simpan(s);
  console.log(`✓ Application URL = ${appUrl}, nama aplikasi = Cupil Stuff`);
}

/** Trusted proxy: IP asli dibaca dari header CF-Connecting-IP (Cloudflare Tunnel). */
async function aturTrustedProxy() {
  const s = await ambil();
  s.trustedProxy = s.trustedProxy || {};
  s.trustedProxy.headers = ["CF-Connecting-IP"];
  s.trustedProxy.useLeftmostIP = false;
  await simpan(s);
  console.log("✓ Trusted proxy: IP asli dibaca dari header CF-Connecting-IP");
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
  const s = await ambil();
  s.s3 = s.s3 || {};
  s.s3.enabled = true;
  s.s3.bucket = bucket;
  s.s3.region = "auto";
  s.s3.endpoint = endpoint;
  s.s3.accessKey = access;
  s.s3.secret = secret;
  s.s3.forcePathStyle = true;
  await simpan(s);
  console.log(`✓ S3/R2 aktif: bucket ${bucket}, region auto, force path style`);
}

/** Backup harian ke R2, simpan 7 terakhir. */
async function aturBackup() {
  const endpoint = (E.R2_ENDPOINT || "").trim();
  if (!endpoint || !(E.R2_BUCKET || "").trim()) {
    console.log("ℹ R2 belum diisi — backup ke S3 dilewati.");
    return;
  }
  const s = await ambil();
  s.backups = s.backups || {};
  s.backups.cron = "0 2 * * *";
  s.backups.cronMaxKeep = 7;
  s.backups.s3 = s.backups.s3 || {};
  s.backups.s3.enabled = true;
  s.backups.s3.bucket = (E.R2_BACKUP_BUCKET || E.R2_BUCKET || "").trim();
  s.backups.s3.region = "auto";
  s.backups.s3.endpoint = endpoint;
  s.backups.s3.accessKey = (E.R2_ACCESS_KEY_ID || "").trim();
  s.backups.s3.secret = (E.R2_SECRET_ACCESS_KEY || "").trim();
  s.backups.s3.forcePathStyle = true;
  await simpan(s);
  console.log(`✓ Backup harian 02.00 ke ${s.backups.s3.bucket}, simpan 7 terakhir`);
}

/** SMTP dari env. Peringatan login superuser dari IP baru aktif dengan SMTP. */
async function aturSmtp() {
  const host = (E.SMTP_HOST || "").trim();
  if (!host) {
    console.log("ℹ SMTP_HOST kosong — SMTP dilewati (peringatan login tidak terkirim lewat email).");
    return;
  }
  const s = await ambil();
  s.smtp = s.smtp || {};
  s.smtp.enabled = true;
  s.smtp.host = host;
  s.smtp.port = Number(E.SMTP_PORT || 587);
  s.smtp.username = (E.SMTP_USER || "").trim();
  s.smtp.password = (E.SMTP_PASS || "").trim();
  s.smtp.tls = String(E.SMTP_TLS || "true") !== "false";
  s.smtp.authMethod = s.smtp.username ? "plain" : "";
  await simpan(s);
  console.log(`✓ SMTP aktif ke ${host}:${s.smtp.port} (pengirim ${s.smtp.username || "-"})`);
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
  console.log("\nSelesai. Periksa di panel admin (Settings), lalu jalankan scripts/cek-produksi.sh.");
}

main().catch((err) => {
  console.error("\n✗ Gagal:", err.message);
  process.exit(1);
});