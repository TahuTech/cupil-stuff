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

Data contoh untuk development (kategori Pisau/Figur, EDC-001, MDL-001, EDC-002 nonaktif). Skrip ini menghapus lalu membuat ulang data contoh, jadi **jangan jalankan ke produksi**:

```bash
docker compose exec pocketbase /pb/pocketbase superuser upsert dev@cupilstuff.local PASSWORD --dir=/pb/pb_data
PB_EMAIL=dev@cupilstuff.local PB_PASSWORD=PASSWORD SEED_GLB=/path/model.glb node scripts/seed-dev.mjs
```

```
cupil-stuff/
├── docker-compose.yml        PocketBase + Cloudflare Tunnel (jalan di homelab)
├── .env.example
├── pocketbase/
│   ├── Dockerfile            PocketBase v0.40.3 (versi dikunci)
│   ├── pb_migrations/        skema koleksi + data 6 zona ongkir
│   └── pb_hooks/             build ulang otomatis, kode varian otomatis, route checkout/pesanan/servis/tiket
└── web/                      katalog Astro (di-deploy ke Cloudflare Pages)
    └── src/
        ├── config.ts         nama toko, nomor WhatsApp, alamat kirim dan info antar servis
        ├── components/       Maskot, BannerServer (banner saat homelab mati)
        ├── lib/pb.ts         ambil data dari PocketBase saat build
        ├── lib/ongkir.ts     rumus ongkir (dipakai di tahap 3) + ongkir.test.ts
        ├── lib/servis.ts     form servis (validasi = server, kecilkan foto) + servis.test.ts, servis-hook.test.ts
        ├── lib/status-server.ts  deteksi server hidup/mati (/api/health, timeout 3 dtk, cache 60 dtk) + test
        ├── lib/pesan-wa.ts   isi pesan WhatsApp saat server mati (keranjang, servis, cek tiket/bayar) + test
        └── pages/            landing (/), katalog, produk, keranjang, bayar, servis, cek-tiket, 404
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
- Environment variables: `PUBLIC_PB_URL=https://api.<domain>`, `PUBLIC_CDN_URL=https://cdn.<domain>`, `PUBLIC_SITE_URL=https://<domain>`, dan `PUBLIC_QRIS_STATIS` (teks QRIS statis toko; lihat bagian Pembayaran)
- Di `.env` homelab, isi `PB_ORIGINS=https://<domain>` supaya browser boleh memanggil `/api/checkout` (CORS), lalu `docker compose up -d` lagi.
- **Settings → Builds → Deploy hooks**: buat hook, lalu isi URL-nya ke `PAGES_DEPLOY_HOOK` di `.env` homelab, kemudian `docker compose up -d` lagi. Setiap perubahan produk akan memicu build ulang, paling banyak sekali per 60 detik.

## Mengisi produk

Urutannya: **kategori → produk → varian**.

- **Kode produk**: `EDC-001`, `MDL-001` (huruf besar, awalan 3 huruf, nomor 3 digit). Kode varian boleh dikosongkan, nanti terisi otomatis (`EDC-001-1`, `EDC-001-2`).
- **Setiap produk butuh minimal 1 varian** (harga, berat kirim, stok). Produk tanpa varian tidak tampil.
- **Berat kirim** dalam gram = berat barang + packing, atau berat volume (p × l × t cm ÷ 6000 × 1000) jika lebih besar.
- **Warna** (khusus model 3D) diisi dalam format JSON: `[{"nama":"Asli","hex":null},{"nama":"Merah","hex":"#e53935"}]`
- **Bagian warna**: kosongkan supaya semua bagian berubah, atau isi nama material, misalnya `["Body"]`. Nama material muncul di Console browser (F12) saat membuka halaman produk.
- Centang **aktif** supaya produk tampil di katalog.
- Centang **unggulan** supaya produk tampil di "Produk pilihan" di landing page (maks. 4). Jika tidak ada yang dicentang, yang tampil 4 produk terbaru.
- Toko marketplace untuk footer: isi `marketplace` di `web/src/config.ts`.
- Ganti `nomorWA` di `web/src/config.ts`.
- Jika desain kepala maskot (`assets/maskot/maskot-kepala.svg`) berubah, buat ulang favicon dengan `python3 scripts/buat-favicon.py` (butuh `rsvg-convert`).

## Pesanan dan pembayaran

1. Pembeli memasukkan barang ke keranjang (tersimpan di browser), memilih provinsi, lalu mengisi nama, WhatsApp, dan alamat.
2. `POST /api/checkout` menghitung ulang semuanya di server (harga, stok, berat, zona, ongkir, potongan, total) dan menyimpan pesanan `CS-YYMMDD-XXXX` dengan status bayar **menunggu**.
3. Halaman pesanan berhasil menampilkan QRIS dengan nominal total. Pembeli mengirim bukti bayar lewat WhatsApp.
4. Pemilik mengecek mutasi, lalu mengubah status bayar menjadi **lunas** di panel admin (pengurangan stok otomatis).

Di atas 5 kg atau provinsi tanpa zona: pesanan tetap tersimpan dengan `ongkir_konfirmasi`, QRIS tidak ditampilkan, dan pembeli diarahkan ke WhatsApp.

Pembatasan per IP (dari header Cloudflare): paling banyak 10 pesanan dan 10 tiket servis per jam, serta 30 percobaan per jam untuk masing-masing route (termasuk isian yang ditolak). Pembeli yang melewati batas mendapat pesan untuk mencoba lagi beberapa menit kemudian atau menghubungi lewat WhatsApp. Batasnya ada di `pocketbase/pb_hooks/kuota.js`.

## Panduan pemilik toko: memproses pesanan

**Akses panel admin:** buka `api.<domain>/_/` (login lewat Cloudflare Access dulu). Tidak ada panel admin terpisah — semua proses dilakukan langsung dari dashboard PocketBase bawaan di koleksi **pesanan**. Setelah login, buka `api.<domain>/_/#/collections/pesanan`, klik record pesanan yang ingin diproses, ubah field yang diperlukan, lalu simpan. Link WhatsApp (`link_wa_*`) bisa langsung diklik dari panel untuk mengirim pesan ke pembeli.

Link WhatsApp di pesanan dihitung ulang otomatis setiap kali pesanan disimpan, jadi selalu sesuai total, status, dan resi terbaru.

### Pesanan biasa (≤ 5 kg)

1. **Cek mutasi**: pastikan uang masuk sesuai `total` pesanan. Jika pembeli belum membayar, `link_wa_ongkir` bisa dipakai untuk mengingatkan total + tautan `/bayar`.
2. **Ubah status bayar → lunas**, lalu simpan. Stok semua barang berkurang otomatis. Jika stok salah satu barang tidak cukup, perubahan ditolak dan **tidak ada** stok yang berubah (cek dan perbaiki stok dulu).
3. **Kabari pembeli**: klik `link_wa_lunas` (konfirmasi pembayaran diterima).
4. **Kemas barang** sesuai rincian `items`.
5. **Isi resi** J&T, ubah `status_kirim` ke `dikirim`, lalu klik `link_wa_resi` (nomor resi + halaman lacak J&T). Pembeli juga bisa melihat resi di `/bayar`.

**Batal**: ubah `status_bayar` ke `batal`. Jika sebelumnya sudah lunas, stok dikembalikan otomatis.

### Pesanan di atas 5 kg (ongkir perlu konfirmasi)

1. Cek berat dan alamat di pesanan (`ongkir_konfirmasi` = true, `link_wa_ongkir` masih kosong).
2. **Isi ongkir** manual di field `ongkir`, lalu simpan. `potongan_ongkir` dan `total` dihitung ulang otomatis, dan `ongkir_konfirmasi` menjadi false.
3. **Kirim info total**: klik `link_wa_ongkir` (total akhir + tautan `/bayar`, tempat pembeli melihat QRIS bernominal).
4. Setelah pembeli membayar, lanjutkan seperti pesanan biasa dari langkah 2.

### Mengecek pembayaran (pembeli)

Pembeli bisa mengecek status dan membayar lewat halaman `/bayar?nomor=CS-YYMMDD-XXXX`:
- Masukkan 4 digit terakhir WhatsApp
- Jika sudah lunas dan ada resi, tampil nomor resi + tautan lacak J&T
- Jika belum lunas, tampil QRIS bernominal

## Halaman /bayar

Route `GET /api/pesanan/{nomor}?wa=XXXX` mengembalikan data terbatas:
- status bayar, rincian barang, ongkir, potongan, total
- **Tanpa** alamat, nama pembeli, dan nomor WA lengkap
- Percobaan gagal (4 digit WA salah atau nomor pesanan tidak ada): maksimal 5 kali per 15 menit dari IP yang sama (IP dari header Cloudflare), lalu diblokir sampai 15 menit itu habis

**Teks QRIS toko** (`PUBLIC_QRIS_STATIS`): scan stiker QRIS dengan aplikasi pembaca QR, salin teksnya (diawali `000201`), lalu isi di `web/.env` dan di environment variables Cloudflare Pages. Jangan commit nilainya. Uji dengan scan dari aplikasi bank/e-wallet sampai layar konfirmasi saja (jangan dibayar), pastikan nama toko dan nominalnya benar.

## Notifikasi Telegram untuk pemilik toko

Setiap pesanan baru, pesanan yang ongkirnya perlu dikonfirmasi (di atas 5 kg atau provinsi tanpa zona), dan tiket servis baru dikirim ke Telegram: nomor, total atau jasa, dan link langsung ke record di panel admin. Gratis, tanpa layanan berbayar.

1. Di Telegram, buka **@BotFather**, kirim `/newbot`, ikuti petunjuknya. Simpan **token** yang diberikan (bentuknya `123456789:AA...`).
2. Buka bot barumu dan kirim pesan apa saja (misalnya `halo`), supaya bot boleh mengirim pesan kepadamu.
3. Buka `https://api.telegram.org/bot<TOKEN>/getUpdates` di browser. Cari `"chat":{"id":...}`; angka itu adalah **chat id**.
4. Isi di `.env` homelab: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, dan `API_URL=https://api.<domain>` (untuk link ke panel admin). Lalu `docker compose up -d` lagi.

Jika token atau chat id kosong, notifikasi dilewati tanpa galat. Jika Telegram sedang gangguan, pesanan dan tiket tetap tersimpan (pembeli menunggu paling lama sekitar 5 detik) dan kegagalannya tercatat di **Logs** panel admin. Jangan simpan token di repo.

## Pemantauan server dari luar (disarankan)

Notifikasi Telegram di atas **dikirim dari homelab**, jadi ikut mati saat homelab/PocketBase mati — justru saat kamu paling perlu tahu. Karena itu, pantau dari **luar**:

- Daftar gratis di [UptimeRobot](https://uptimerobot.com) (atau layanan sejenis), buat monitor tipe **HTTP(s)** ke `https://api.<domain>/api/health`. Atur interval 5 menit.
- `/api/health` adalah endpoint bawaan PocketBase (menjawab `{"code":200,...}` selama server hidup), jadi tidak perlu membuat route sendiri.
- Aktifkan **alert contact** ke email (gratis) dan/atau **Telegram**: UptimeRobot punya integrasi Telegram bawaan (isi token bot + chat id yang sama seperti bagian sebelumnya). Dengan begitu kamu tetap dapat kabar walau homelab mati total.
- Tambahkan monitor kedua ke `https://<domain>` (katalog) untuk memastikan situs statis tetap terbuka.

Situs katalog memakai deteksi yang sama di browser: bila `/api/health` tidak menjawab dalam 3 detik, halaman keranjang, servis, cek tiket, dan bayar otomatis beralih ke pesan lewat WhatsApp (banner kecil "Pemesanan otomatis sedang istirahat"). Begitu server hidup lagi, halaman kembali normal sendiri dalam sekitar 15 detik, tanpa reload.

## Jasa servis

Alur customer:

1. Buka `/servis`: daftar jasa, portofolio sebelum/sesudah, dan aturan (tanpa DP, cek gratis, bayar penuh setelah selesai, tolak estimasi hanya bayar ongkir kirim balik, boleh antar dan ambil langsung).
2. Isi form: jenis servis, jenis + merek perangkat, keluhan, foto (opsional, maks 5, dikecilkan di browser), nama, WhatsApp, cara kirim (kurir/antar), provinsi kirim balik (wajib jika kurir).
3. `POST /api/servis` membuat tiket `SRV-YYMMDD-XXXX` (status `menunggu_perangkat`). Halaman menampilkan nomor tiket, alamat kirim (atau info antar), tombol WhatsApp, dan ajakan menyimpan nomor tiket.
4. Customer memantau status di `/cek-tiket` (nomor tiket + 4 digit terakhir WA): urutan langkah, estimasi, tagihan, dan QRIS bernominal.

Cara memproses tiket (panel admin `api.<domain>/_/`, koleksi **tiket_servis**). Setiap kali tiket disimpan, `ongkir_kirim_balik`, `total_tagihan`, dan link WhatsApp dihitung ulang otomatis. Buka link `link_wa_*` untuk mengirim kabar ke customer (pesan sudah terisi):

1. **Perangkat datang**: ubah status ke `diterima`, lalu buka `link_wa_diterima`.
2. **Dicek**: ubah ke `dicek` selama pemeriksaan (gratis).
3. **Estimasi**: isi `estimasi_biaya`, ubah ke `menunggu_persetujuan`, lalu buka `link_wa_estimasi`. Customer bisa setuju/tolak dari `/cek-tiket`.
4. **Disetujui**: ubah ke `dikerjakan`. Setelah beres, isi `biaya_final` dan ubah ke `selesai`, lalu buka `link_wa_selesai` (berisi total = biaya + ongkir kirim balik). Customer membayar lewat QRIS di `/cek-tiket`.
5. **Ditolak**: ubah ke `dikembalikan`, lalu buka `link_wa_selesai`. Tagihannya hanya ongkir kirim balik; jika antar langsung, tidak ada tagihan.
6. **Kirim balik**: isi `resi`, ubah ke `dikirim`, lalu buka `link_wa_resi`.

Ongkir kirim balik dihitung dari zona provinsi customer dan berat bawaan perangkat (`BERAT_PERANGKAT` di `pocketbase/pb_hooks/servis.js`). Jika provinsi tidak punya zona, nilainya 0: isi `ongkir_kirim_balik` secara manual (nilai manual tidak ditimpa, kecuali cara kirim/provinsi/jenis perangkat diubah). Alamat kirim dan info antar ada di `web/src/config.ts` (`SERVIS`). Di `.env` homelab, isi `SITE_URL` agar tautan `/cek-tiket` di pesan WhatsApp mengarah ke domain katalog.

## Data uji dan database produksi

**Database produksi dimulai kosong.** Jangan menyalin folder `pocketbase/pb_data` dari komputer development ke homelab. Saat PocketBase produksi pertama kali jalan, migrasi membuat semua koleksi dan 6 zona ongkir; kategori, produk, varian, jasa, dan portofolio diisi pemilik lewat panel admin. `scripts/seed-dev.mjs` dan `scripts/bersihkan-data-uji.mjs` hanya untuk lokal.

Membersihkan pesanan dan tiket servis uji di lokal (katalog dan zona ongkir tidak disentuh; stok tidak dikembalikan):

```bash
PB_EMAIL=dev@cupilstuff.local PB_PASSWORD=PASSWORD node scripts/bersihkan-data-uji.mjs
```

Skrip menampilkan jumlah dan contoh nomor yang akan dihapus, lalu meminta kamu mengetik `HAPUS`. Skrip menolak berjalan jika `PB_URL` bukan localhost/127.0.0.1.

## Status

- [x] Tahap 1: PocketBase, skema, zona ongkir, hook build ulang
- [x] Tahap 2: landing page, katalog (cari, filter lini/kategori), halaman produk (galeri, 3D + warna, varian, stok, jumlah, pesan via WhatsApp, link marketplace)
- [x] Tahap 3: keranjang, ongkir per zona, checkout (`POST /api/checkout`, hitung ulang di server), QRIS nominal otomatis, pesanan tersimpan
- [x] Tahap 4: konfirmasi bayar, stok otomatis, ongkir manual, link WA, halaman /bayar
- [x] Tahap 5: halaman jasa servis, form + nomor tiket (`POST /api/servis`), cek status (`GET /api/tiket`), tagihan + ongkir kirim balik dihitung di server, QRIS, link WA pemilik
- [x] Mode WhatsApp saat homelab mati: deteksi `/api/health` (timeout 3 detik, cache 60 detik), keranjang/servis/cek tiket/bayar beralih ke WhatsApp, banner di halaman terdampak

## Catatan

Sudah dicek: migrasi berjalan di PocketBase 0.40.3 (6 zona ongkir terisi), `npm run check` 0 error, `npm test` lulus (218 test, termasuk deteksi status server dan isi pesan WA), dan `npm run build` berhasil (10 halaman). Route `/api/servis` dan `/api/tiket` diuji langsung dengan curl (validasi, foto, ongkir kirim balik, tagihan, respons tanpa data pribadi, pembatasan 5 kali salah per IP selama 15 menit). Mode WhatsApp diuji dengan `docker compose stop pocketbase`: katalog dan halaman tetap terbuka, keranjang/servis/cek tiket/bayar menampilkan banner dan beralih ke WhatsApp; setelah `docker compose start pocketbase` semua kembali normal tanpa reload. Jika migrasi gagal, cek `docker compose logs pocketbase`.
