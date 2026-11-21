# Go-live Cupil Stuff — checklist

Domain: **cupilstuff.web.id**
Katalog `https://cupilstuff.web.id` · API `https://api.cupilstuff.web.id` · CDN `https://cdn.cupilstuff.web.id`

Aturan main: **kamu yang mengisi semua token/password sendiri.** Jangan tempelkan nilai rahasia ke chat, commit, atau log. Repo hanya berisi *nama* variabel (`.env.example`).

Kerjakan berurutan. Langkah bertanda **[manual]** dilakukan di dashboard Cloudflare/Telegram; sisanya lewat perintah di terminal homelab. Centang setiap kotak setelah selesai.

---

## 0. Persiapan [manual]

- [ ] Domain `cupilstuff.web.id` sudah aktif di Cloudflare (NS mengarah ke Cloudflare, status **Active**).
- [ ] Akun Cloudflare punya akses ke **R2**, **Zero Trust (Tunnels + Access)**, dan **Pages**.
- [ ] Di homelab: `cp .env.example .env` lalu isi `CLOUDFLARE_TUNNEL_TOKEN` (lihat langkah 2). Variabel lain diisi sambil jalan.

---

## 1. Database produksi bersih

Database produksi **mulai kosong**. Jangan menyalin `pocketbase/pb_data` dari komputer development.

- [ ] Di homelab (mesin baru, folder `pb_data` kosong):
  ```bash
  ./scripts/siapkan-produksi.sh
  ```
  Skrip menolak jalan bila `pb_data` sudah berisi data, menjalankan migrasi (koleksi + 6 zona ongkir, **tanpa** data contoh), lalu menampilkan perintah superuser.
- [ ] Buat superuser (kamu yang mengetik email dan password):
  ```bash
  docker compose exec pocketbase /pb/pocketbase superuser upsert EMAIL_KAMU PASSWORD_KUAT --dir=/pb/pb_data
  ```
- [ ] Buka `http://127.0.0.1:8090/_/` dari mesin homelab, login, pastikan koleksi ada dan `zona_ongkir` berisi 6 baris.

---

## 2. Cloudflare Tunnel [manual]

- [ ] Zero Trust → **Networks → Tunnels → Create a tunnel** (tipe *cloudflared*), nama `cupil-stuff`.
- [ ] Salin **token connector** ke `CLOUDFLARE_TUNNEL_TOKEN` di `.env` homelab.
- [ ] Tunnel → **Public Hostnames → Add a public hostname**:
  - Subdomain `api`, Domain `cupilstuff.web.id`
  - Service: **HTTP** → `pocketbase:8090`
- [ ] Nyalakan tunnel:
  ```bash
  docker compose --profile tunnel up -d --build
  ```
- [ ] Uji dari luar: `curl -i https://api.cupilstuff.web.id/api/health` → `200` dengan body berisi `"code":200`.

---

## 3. Cloudflare Access untuk panel admin [manual]

Tujuan: `https://api.cupilstuff.web.id/_/` hanya bisa dibuka email pemilik. **`/api/*` harus TETAP terbuka** untuk katalog.

- [ ] Zero Trust → **Access → Applications → Add an application → Self-hosted**.
- [ ] Application name: `Cupil Stuff Admin`.
- [ ] **Application domain**: subdomain `api`, domain `cupilstuff.web.id`, **path `_`**.
      Path `_` membatasi proteksi hanya ke panel, bukan seluruh `api.cupilstuff.web.id`.
- [ ] **JANGAN** memakai path `*` — pastikan isinya hanya `_`.
- [ ] Policy: **Allow**, Include → **Emails** → email pemilik (dan hanya itu).
- [ ] Login method: **One-time PIN** (gratis, tanpa IdP).
- [ ] Uji:
  - `https://api.cupilstuff.web.id/_/` di jendela privat → harus minta login Access.
  - `https://api.cupilstuff.web.id/api/health` → `200` **tanpa** login (bukti `/api/*` tidak terkunci).

> Bila Access ikut memblokir `/api/*`, katalog tidak bisa checkout. `./scripts/cek-produksi.sh` (langkah 9) mengecek ini otomatis.

---

## 4. Cloudflare R2 (file + backup) [manual]

- [ ] R2 → **Create bucket**: `cupilstuff-files` (pisahkan dari bucket proyek lain).
- [ ] Bucket → **Settings → Custom Domains → Connect Domain**: `cdn.cupilstuff.web.id`.
- [ ] Bucket → **Settings → CORS Policy**:
  ```json
  [
    {
      "AllowedOrigins": ["https://cupilstuff.web.id"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"]
    }
  ]
  ```
- [ ] R2 → **Manage R2 API Tokens → Create API token**, permission **Object Read & Write**, batasi ke bucket `cupilstuff-files` saja. Simpan ke `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
- [ ] Isi `.env` homelab:
  ```
  R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_BUCKET=cupilstuff-files
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
  ```
  (`<ACCOUNT_ID>` dari dashboard R2, bukan rahasia.)

---

## 5. Pengaturan PocketBase sebagai kode

- [ ] Isi sisa `.env` homelab (lihat `.env.example`): `SITE_URL`, `API_URL`, `PB_ORIGINS`, `TELEGRAM_*`, `R2_*`, `SMTP_*`.
- [ ] Jalankan skrip idempoten (boleh diulang):
  ```bash
  PB_EMAIL=EMAIL_KAMU PB_PASSWORD=PASSWORD_KUAT node scripts/siapkan-pocketbase.mjs
  ```
  Skrip mengatur: Application URL `https://api.cupilstuff.web.id`, nama aplikasi `Cupil Stuff`, trusted proxy `CF-Connecting-IP`, cek `PB_ORIGINS`, S3 ke R2 (region `auto`, force path style), backup harian 02.00 simpan 7, SMTP dari env.
- [ ] Nyalakan ulang dengan env baru: `docker compose up -d --build`.
- [ ] Panel admin → **Settings**: periksa Application URL, Files storage (S3 aktif), Backups (cron harian, keep 7), SMTP.
- [ ] Uji upload: buat produk/varian dengan foto, pastikan file muncul di bucket `cupilstuff-files` dan bisa dibuka lewat `cdn.cupilstuff.web.id`.

---

## 6. Cloudflare Pages (katalog) [manual]

- [ ] Pages → **Create a project** → hubungkan repo GitHub.
- [ ] **Root directory**: `web`. Build command `npm run build`, output `dist`.
- [ ] **Environment variables** (produksi):
  ```
  PUBLIC_PB_URL=https://api.cupilstuff.web.id
  PUBLIC_CDN_URL=https://cdn.cupilstuff.web.id
  PUBLIC_SITE_URL=https://cupilstuff.web.id
  PUBLIC_QRIS_STATIS=<teks QRIS statis toko; isi sendiri, jangan di-commit>
  ```
  Build **gagal dengan pesan jelas** bila `PUBLIC_PB_URL` atau `PUBLIC_SITE_URL` kosong (lihat `web/scripts/cek-env-build.mjs`).
- [ ] **Custom domains**: tambah `cupilstuff.web.id` (domain utama).
- [ ] Tambahkan juga `www.cupilstuff.web.id`, lalu buat **Redirect Rule** (Rules → Redirect Rules):
  dari `www.cupilstuff.web.id/*` ke `https://cupilstuff.web.id/$1` (301, permanen).
- [ ] Deploy, buka `https://cupilstuff.web.id`, pastikan `https://www.cupilstuff.web.id` dialihkan ke domain utama.
- [ ] Settings → **Builds → Deploy hooks** → buat hook `katalog`. Salin URL-nya ke `PAGES_DEPLOY_HOOK` di `.env` homelab, lalu `docker compose up -d`.

---

## 7. Notifikasi Telegram + email [manual]

- [ ] Buat bot lewat **@BotFather** (`/newbot`), simpan token ke `TELEGRAM_BOT_TOKEN`.
- [ ] Kirim satu pesan ke bot, buka `https://api.telegram.org/bot<TOKEN>/getUpdates`, salin `chat.id` ke `TELEGRAM_CHAT_ID`.
- [ ] Isi `API_URL=https://api.cupilstuff.web.id` supaya notifikasi memuat link ke record admin.
- [ ] `docker compose up -d`, lalu uji dengan membuat tiket servis uji (langkah 9) → pesan Telegram harus masuk.

---

## 8. UptimeRobot (pemantauan dari luar) [manual]

Notifikasi Telegram di atas dikirim **dari homelab**, jadi ikut mati saat homelab mati. Pantau dari luar.

- [ ] Daftar gratis di <https://uptimerobot.com>.
- [ ] **Add New Monitor** → tipe **HTTP(s)** → URL `https://api.cupilstuff.web.id/api/health`, interval **5 menit**.
- [ ] Monitor kedua → URL `https://cupilstuff.web.id` (katalog statis harus tetap 200 walau homelab mati).
- [ ] **Alert Contacts**: tambah email, dan/atau integrasi **Telegram** (token bot + chat id yang sama).

---

## 9. Uji akhir (setelah semua aktif)

- [ ] **Pesanan dari HP**: buka `https://cupilstuff.web.id` di HP, tambah barang, isi data, checkout → QRIS bernominal tampil. Scan dengan aplikasi bank/e-wallet **sampai layar konfirmasi saja** (jangan dibayar); pastikan nama toko dan nominal benar.
- [ ] **Notifikasi Telegram** pesanan baru masuk.
- [ ] Admin → buka pesanan uji → ubah `status_bayar` ke **lunas** → simpan. Stok varian berkurang dan katalog di-build ulang (tunggu ±1 menit, cek stok di halaman produk berubah).
- [ ] **Uji homelab mati**:
  ```bash
  docker compose stop pocketbase
  ```
  - Katalog, foto, dan 3D tetap terbuka (dilayani Cloudflare Pages + R2).
  - Keranjang, servis, cek tiket, dan bayar menampilkan banner "Pemesanan otomatis sedang istirahat" dan beralih ke WhatsApp.
- [ ] Nyalakan lagi:
  ```bash
  docker compose start pocketbase
  ```
  - Halaman kembali normal dalam **±15 detik** tanpa reload (pemantauan di `web/src/lib/status-server.ts`).
  - UptimeRobot mengirim pemberitahuan **down** lalu **up**.
- [ ] **Hapus pesanan uji** lewat admin (bulk delete di koleksi `pesanan`).
- [ ] Jalankan skrip cek produksi, semua harus lulus:
  ```bash
  ./scripts/cek-produksi.sh
  ```

---

## 10. Setelah go-live

- [ ] Ganti semua `TODO(go-live)` di `web/src/config.ts` (nomor WhatsApp toko, alamat kirim servis, info antar, marketplace).
- [ ] Isi kategori → produk → varian → jasa → portofolio lewat panel admin.
- [ ] Pastikan `pocketbase/pb_data` **tidak** ikut ter-commit (sudah di `.gitignore`).
- [ ] Simpan salinan `.env` di tempat aman (bukan di repo).

