# Cupil Stuff — katalog online

Katalog online Cupil Stuff. Konteks proyek, stack, dan aturan bisnis ada di **CLAUDE.md**; urutan pengerjaan ada di `docs/TAHAPAN-CLAUDE-CODE.md`.

## Ringkas: menjalankan dev

```bash
cp .env.example .env                     # token boleh kosong untuk dev lokal
docker compose up -d --build             # hanya PocketBase: http://127.0.0.1:8090/_/
cd web && cp .env.example .env           # ganti PUBLIC_PB_URL=http://127.0.0.1:8090, kosongkan PUBLIC_CDN_URL
npm install
npm run dev                              # http://localhost:4321
npm test                                 # unit test hitungan (ongkir, dst.)
```

PocketBase harus jalan saat `npm run dev`/`npm run build`, karena data katalog diambil saat build.

```
cupil-stuff/
├── docker-compose.yml        PocketBase + Cloudflare Tunnel (jalan di homelab)
├── .env.example
├── pocketbase/
│   ├── Dockerfile            PocketBase v0.40.3 (versi dikunci)
│   ├── pb_migrations/        skema koleksi + data 6 zona ongkir
│   └── pb_hooks/             build ulang otomatis, kode varian otomatis
└── web/                      katalog Astro (di-deploy ke Cloudflare Pages)
    └── src/
        ├── config.ts         nama toko, nomor WhatsApp
        ├── lib/pb.ts         ambil data dari PocketBase saat build
        ├── lib/ongkir.ts     rumus ongkir (dipakai di tahap 3) + ongkir.test.ts
        └── pages/            beranda katalog, halaman produk
```

## 1. Jalankan PocketBase di homelab

```bash
cp .env.example .env        # isi nanti setelah Tunnel dibuat
docker compose up -d --build   # tanpa profile: hanya PocketBase
docker compose exec pocketbase /pb/pocketbase superuser upsert email@kamu.com PASSWORD_KUAT --dir=/pb/pb_data
```

Buka `http://127.0.0.1:8090/_/` dari mesin homelab. Semua koleksi dan 6 zona ongkir sudah terbuat otomatis dari migrasi.

## 2. Hubungkan R2 (file + backup)

Di account Cloudflare usaha, buat bucket baru, misalnya `cupilstuff-files` (pisahkan dari bucket Fotamu), lalu buat **R2 API token** yang hanya bisa mengakses bucket itu.

Di panel PocketBase:

- **Settings → Files storage → Use S3 storage**
  - Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
  - Bucket: `cupilstuff-files` · Region: `auto`
  - Access key dan secret dari R2 API token
  - Centang **Force path-style addressing**
- **Settings → Backups**: aktifkan backup harian ke S3 (bucket yang sama atau bucket khusus backup), simpan misalnya 7 backup terakhir.

Agar katalog memuat file langsung dari R2 (bukan lewat homelab):

1. R2 → bucket → **Settings → Custom Domains**: tambahkan `cdn.<domain>`.
2. **CORS policy** bucket (diperlukan supaya model-viewer bisa memuat `.glb`):
   ```json
   [{ "AllowedOrigins": ["https://<domain>", "http://localhost:4321"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"] }]
   ```

## 3. Cloudflare Tunnel

Zero Trust → Networks → Tunnels → buat tunnel (tipe *cloudflared*), lalu salin token-nya ke `CLOUDFLARE_TUNNEL_TOKEN` di `.env`.

Public hostname: `api.<domain>` → `http://pocketbase:8090`

```bash
docker compose --profile tunnel up -d
```

Tanpa `--profile tunnel`, `cloudflared` tidak dijalankan (cocok untuk development).

Untuk panel admin, buat aplikasi **Cloudflare Access** di path `api.<domain>/_/` supaya hanya emailmu yang bisa masuk.

## 4. Katalog (Astro)

```bash
cd web
cp .env.example .env     # PUBLIC_PB_URL=http://127.0.0.1:8090 saat development
npm install
npm run dev              # http://localhost:4321
```

Data diambil dari PocketBase **saat build**. Kalau ada perubahan produk saat `npm run dev`, cukup muat ulang halaman.

### Deploy ke Cloudflare Pages

- Hubungkan repo GitHub, dengan **Root directory** `web`
- Build command `npm run build`, output `dist`
- Environment variables: `PUBLIC_PB_URL=https://api.<domain>`, `PUBLIC_CDN_URL=https://cdn.<domain>`, `PUBLIC_SITE_URL=https://<domain>`
- **Settings → Builds → Deploy hooks**: buat hook, lalu isi URL-nya ke `PAGES_DEPLOY_HOOK` di `.env` homelab, kemudian `docker compose up -d` lagi. Setiap perubahan produk akan memicu build ulang, paling banyak sekali per 60 detik.

## Mengisi produk

Urutannya: **kategori → produk → varian**.

- **Kode produk**: `EDC-001`, `MDL-001` (huruf besar, awalan 3 huruf, nomor 3 digit). Kode varian boleh dikosongkan, nanti terisi otomatis (`EDC-001-1`, `EDC-001-2`).
- **Setiap produk butuh minimal 1 varian** (harga, berat kirim, stok). Produk tanpa varian tidak tampil.
- **Berat kirim** dalam gram = berat barang + packing, atau berat volume (p × l × t cm ÷ 6000 × 1000) jika lebih besar.
- **Warna** (khusus model 3D) diisi dalam format JSON: `[{"nama":"Asli","hex":null},{"nama":"Merah","hex":"#e53935"}]`
- **Bagian warna**: kosongkan supaya semua bagian berubah, atau isi nama material, misalnya `["Body"]`. Nama material muncul di Console browser (F12) saat membuka halaman produk.
- Centang **aktif** supaya produk tampil di katalog.
- Ganti `nomorWA` di `web/src/config.ts`.

## Status

- [x] Tahap 1: PocketBase, skema, zona ongkir, hook build ulang
- [x] Tahap 2: beranda (cari, filter lini/kategori), halaman produk (galeri, 3D + warna, varian, stok, jumlah, pesan via WhatsApp, link marketplace)
- [ ] Tahap 3: keranjang, ongkir per zona, QRIS nominal otomatis, pesanan tersimpan
- [ ] Tahap 4: halaman jasa servis, form + nomor tiket, cek status

## Catatan

Sudah dicek: migrasi berjalan di PocketBase 0.40.3 (6 zona ongkir terisi), `npm test` lulus, dan `npm run build` berhasil dengan katalog kosong. Halaman produk belum dicoba dengan data sungguhan. Jika migrasi gagal, cek `docker compose logs pocketbase`.
