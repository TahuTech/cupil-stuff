# Cupil Stuff — katalog online

Toko online milik sendiri untuk Cupil Stuff (Surabaya): model 3D buatan sendiri, barang EDC (pisau, peluit, dan sejenisnya), serta jasa servis mouse dan keyboard mechanical. Tujuannya: customer bisa melihat produk, memilih varian, menghitung ongkir, dan membayar lewat QRIS tanpa harus bertanya dulu via WhatsApp.

Biaya rutin harus tetap praktis hanya domain. Jangan menambah layanan berbayar, API kurir, atau payment gateway tanpa diminta.

## Stack

| Bagian | Pilihan |
| --- | --- |
| Katalog | Astro (output statis), di-deploy ke Cloudflare Pages |
| CMS + database | PocketBase **v0.40.x** (JS hooks dan migrations gaya v0.23+), berjalan di Docker di homelab |
| Akses dari internet | Cloudflare Tunnel (`cloudflared` di docker compose); tanpa port forwarding |
| File (foto, .glb) dan backup | Cloudflare R2 lewat pengaturan S3 PocketBase; katalog memuat file dari `cdn.cupilstuff.web.id` |
| 3D | `<model-viewer>` dari Google (CDN), ganti warna lewat `material.pbrMetallicRoughness.setBaseColorFactor` |
| Pembayaran | QRIS statis toko yang nominalnya disisipkan di browser; konfirmasi manual oleh pemilik |
| Kurir | J&T EZ, tarif flat per zona (tanpa API) |

Domain: **cupilstuff.web.id**. Subdomain: `cdn.cupilstuff.web.id` (R2 publik), `api.cupilstuff.web.id` (PocketBase lewat Tunnel), dan panel admin `api.cupilstuff.web.id/_/` yang dikunci dengan Cloudflare Access (path `_` saja; `/api/*` terbuka).

Prinsip arsitektur: **katalog, foto, dan 3D harus tetap bisa dibuka walaupun homelab mati.** Hanya pesanan baru, cek tiket, dan admin yang boleh bergantung ke homelab.

Saat homelab mati, fitur yang butuh server **jatuh ke WhatsApp** (bukan error buntu): keranjang, servis, cek tiket, dan bayar menampilkan banner "Pemesanan otomatis sedang istirahat" lalu mengirim isian lewat WhatsApp. Deteksi lewat `web/src/lib/status-server.ts` (`GET /api/health`, timeout 3 detik, hasil disimpan 60 detik; juga dianggap mati bila request gagal karena jaringan/timeout/5xx — tapi **bukan** 4xx/429/galat validasi). Landing, katalog, dan halaman produk tidak menampilkan banner.

## Struktur repo

```
docker-compose.yml          pocketbase + cloudflared
pocketbase/Dockerfile       unduh rilis PocketBase sesuai PB_VERSION dan TARGETARCH
pocketbase/pb_migrations/   skema + data awal (zona ongkir)
pocketbase/pb_hooks/        hook dan route khusus (*.pb.js); kode bersama lewat require(`${__hooks}/x.js`)
scripts/                    seed-dev (lokal), siapkan-produksi, siapkan-pocketbase, cek-produksi
docs/GO-LIVE.md             checklist go-live langkah demi langkah
web/                        proyek Astro
```

## Struktur halaman

| Rute | Isi |
| --- | --- |
| `/` | Landing page: hero, tiga kartu lini, produk pilihan (`unggulan`), cara pesan, info ongkir singkat |
| `/katalog` | Pencarian, filter lini/kategori satu baris (tersimpan di URL `?lini=&kategori=`), grid produk |
| `/produk/[kode]` | Detail produk: galeri, 3D + warna, varian, jumlah, pesan |
| `/keranjang` | Keranjang (localStorage: id varian, jumlah, warna), ongkir per provinsi, form checkout |
| `/pesanan-berhasil` | Hasil checkout: maskot senang, nomor, rincian dari server, QRIS bernominal (kecuali ongkir perlu konfirmasi), tombol kirim bukti bayar |
| `/bayar` | Halaman cek dan bayar pesanan: masukkan nomor pesanan + 4 digit terakhir WA, tampil rincian + QRIS bernominal (atau resi jika sudah dikirim) |
| `/servis` | Jasa servis: daftar jasa aktif (nama, perangkat, harga mulai, estimasi), portofolio sebelum/sesudah (disembunyikan jika kosong), aturan (tanpa DP, bayar penuh setelah selesai, cek gratis, tolak estimasi hanya bayar ongkir kirim balik, boleh antar dan ambil langsung), form buka tiket |
| `/cek-tiket` | Cek status tiket servis (nomor tiket + 4 digit terakhir WA): urutan langkah status, estimasi + tombol setuju/tolak, tagihan dari server + QRIS bernominal |
| `/404` | Halaman tidak ditemukan dengan maskot |

Link "kembali ke katalog" selalu ke `/katalog`, bukan `/`.

Halaman `/keranjang`, `/servis`, `/cek-tiket`, dan `/bayar` memakai `lib/status-server.ts` untuk beralih ke WhatsApp. Landing, katalog, dan produk tetap statis tanpa deteksi.

Build memakai `build.format: "file"` (`/katalog` → `katalog.html`). Route API khusus: `POST /api/checkout` (`pb_hooks/checkout.pb.js`), `GET /api/pesanan/{nomor}?wa=XXXX` (`pb_hooks/pesanan.api.pb.js`), `POST /api/servis` (`pb_hooks/servis.pb.js`), `GET /api/tiket/{nomor}?wa=XXXX` (`pb_hooks/tiket.pb.js`); CORS diatur lewat `PB_ORIGINS` (flag `--origins` di compose).

## Data (koleksi PocketBase)

- `kategori`: nama, slug, induk (relasi ke diri sendiri), urutan
- `produk`: kode unik (`MDL-001`, `EDC-001`), nama, lini (`model3d` | `edc`), kategori, deskripsi (editor), foto[], model_3d (.glb, opsional), warna (JSON `[{nama, hex|null}]`), bagian_warna (JSON nama material), link_marketplace, aktif, unggulan (bool; tampil di "Produk pilihan" landing page, maks. 4, jika tidak ada pakai 4 produk terbaru)
- `varian`: produk, kode unik (otomatis `<kode produk>-<n>` jika kosong), nama, harga, berat_kirim (gram), stok, preorder, foto[], urutan. **Setiap produk minimal punya 1 varian.** Harga, berat, dan stok selalu ada di varian.
- `zona_ongkir`: nama, provinsi (JSON), tarif_per_kg, estimasi, urutan
- `pesanan`: nomor (`CS-YYMMDD-XXXX`), items (JSON), pembeli, wa (`628…`), alamat, provinsi, zona, berat_gram, berat_ditagih_kg, subtotal, ongkir, potongan_ongkir, total, ongkir_konfirmasi (bool: di atas 5 kg atau zona tidak ditemukan; total = subtotal dan QRIS tidak ditampilkan), status_bayar (`menunggu` | `lunas` | `batal`), status_kirim, resi, link_wa_ongkir, link_wa_lunas, link_wa_resi (URL wa.me terisi otomatis oleh hook)
- `jasa`: kode (`SRV-001`), nama, perangkat, deskripsi, harga_mulai, estimasi, aktif
- `tiket_servis`: nomor (`SRV-YYMMDD-XXXX`), jasa, nama, wa (`628…`), perangkat_jenis (`mouse` | `keyboard` | `lainnya`), perangkat (merek/tipe), keluhan, foto[] (maks 5, maks 5 MB per foto, dikecilkan di browser), cara_kirim (`kurir` | `antar`), provinsi (tujuan kirim balik, wajib jika kurir), estimasi_biaya, biaya_final, ongkir_kirim_balik (otomatis), total_tagihan (otomatis), resi, link_wa_diterima / link_wa_estimasi / link_wa_selesai / link_wa_resi (otomatis), status (`menunggu_perangkat` | `diterima` | `dicek` | `menunggu_persetujuan` | `dikerjakan` | `selesai` | `dikirim` | `dikembalikan`)
- `portofolio`: judul, foto_sebelum, foto_sesudah, keterangan

Aturan akses: katalog publik bisa dibaca (hanya `aktif = true`). `pesanan` dan `tiket_servis` **tidak boleh** dibuat lewat API koleksi biasa. Keduanya dibuat lewat route khusus di `pb_hooks` yang menghitung harga dan ongkir di server, karena isian dari browser tidak bisa dipercaya.

## Aturan bisnis

### Ongkir (J&T EZ dari Surabaya)

| Zona | Provinsi | Tarif per kg |
| --- | --- | --- |
| Dalam kota | Kota Surabaya | 8.000 |
| Jawa | DKI, Jabar, Banten, Jateng, DIY, Jatim selain Surabaya | 20.000 |
| Bali, NTB, Kalimantan, Sulawesi | Bali, NTB, 5 prov. Kalimantan, 6 prov. Sulawesi | 35.000 |
| Sumatra | 10 provinsi Sumatra | 50.000 |
| NTT dan Maluku | NTT, Maluku, Maluku Utara | 75.000 |
| Papua | 6 provinsi Papua | 100.000 |

- Rumus: `ongkir = tarif_per_kg × berat_ditagih_kg`
- Berat ditagih memakai toleransi J&T 0,3 kg per kg dan minimal 1 kg: 1.300 g → 1 kg, 1.400 g → 2 kg, 2.300 g → 2 kg, 2.310 g → 3 kg.
- Total berat di atas **5 kg**: tidak dihitung otomatis, tampilkan "ongkir dikonfirmasi via WhatsApp".
- **Potongan ongkir**: Rp5.000 per kelipatan Rp100.000 subtotal (100 rb → 5 rb, 200 rb → 10 rb, dan seterusnya), paling banyak sebesar ongkir.
- Contoh: zona Jawa, berat 0,6 kg, subtotal Rp150.000 → ongkir Rp20.000, potongan Rp5.000, dibayar Rp15.000.

### Stok

Stok EDC dipakai bersama dengan marketplace dan diperbarui manual oleh pemilik. Stok berkurang **saat pembayaran dikonfirmasi** (status_bayar menjadi `lunas`), bukan saat barang masuk keranjang. Varian dengan stok 0 dan bukan pre-order tidak bisa dipesan.

### Jasa servis

- Tanpa DP: dibayar penuh setelah servis selesai.
- Pengecekan gratis. Jika customer menolak estimasi, perangkat dikembalikan dan customer hanya membayar ongkir kirim balik.
- Perangkat boleh dikirim lewat kurir atau diantar langsung.
- Ongkir kirim balik memakai tabel zona yang sama dengan berat bawaan per jenis perangkat (`BERAT_PERANGKAT` di `pocketbase/pb_hooks/servis.js`: mouse 300 g, keyboard 900 g, lainnya 500 g), tanpa potongan ongkir. Antar langsung = 0. Alamat kirim dan info antar di `web/src/config.ts` (`SERVIS`).
- Tagihan (dihitung di server, `hitungTagihan` di `servis.js`): `selesai` = biaya_final (atau estimasi jika final kosong) + ongkir kirim balik; `dikembalikan` = HANYA ongkir kirim balik, dan tidak ada tagihan sama sekali jika antar langsung.
- Hook `tiket.hitung.pb.js` menghitung ulang `ongkir_kirim_balik` (saat tiket dibuat atau cara kirim/provinsi/jenis perangkat berubah; selain itu nilai manual dipertahankan), `total_tagihan`, dan `link_wa_*` setiap kali tiket disimpan.
- Alur status tiket: `menunggu_perangkat` (tiket dibuat) → `diterima` → `dicek` → `menunggu_persetujuan` (estimasi diisi pemilik) → `dikerjakan` → `selesai` (biaya final + QRIS) → `dikirim`. Jika ditolak: `dikembalikan` (+ ongkir kirim balik).
- `GET /api/tiket` HANYA mengembalikan status, nama jasa, perangkat, estimasi, biaya final, ongkir kirim balik, tagihan, dan tanggal (`responsPublik` di `servis.js`, punya unit test). Jangan pernah menambahkan nama, WA, keluhan, foto, atau provinsi.
- Cek 4 digit WA (`/api/tiket`, `/api/pesanan`) dibatasi 5 kali gagal per 15 menit per IP (`cekwa.js`). IP diambil dari header `CF-Connecting-IP` (kunci PocketBase: `cf_connecting_ip`); `X-Forwarded-For` tidak dipercaya.

## Konvensi

- Teks antarmuka dalam **Bahasa Indonesia** yang ramah dan singkat. Format uang `Rp 150.000`.
- Komentar kode boleh Bahasa Indonesia.
- Jangan simpan rahasia (token Tunnel, kunci R2, deploy hook) di repo. Pakai `.env` (sudah di `.gitignore`) dan `.env.example`.
- Kunci versi PocketBase di Dockerfile atau compose. Jangan pakai `latest` untuk PocketBase.
- Hook PocketBase: handler berjalan terpisah, jadi variabel di luar handler tidak bisa dibaca. Kode bersama ditaruh di modul dan dipanggil dengan `require()`.
- Setiap logika hitungan (ongkir, potongan, total, nominal QRIS, CRC) harus punya unit test.
- Hitungan ongkir ada di dua tempat: `web/src/lib/ongkir.ts` dan `pocketbase/pb_hooks/ongkir.js`. Ubah keduanya bersamaan; `ongkir-hook.test.ts` memastikan hasilnya sama.
- Isi `PUBLIC_QRIS_STATIS` jangan pernah ditampilkan atau dicatat di log, laporan, maupun commit.
- Tidak ada domain situs tertulis di kode. Hook memakai env `SITE_URL` (tautan `/bayar`, `/cek-tiket`) dan `API_URL` (link panel admin) lewat `pb_hooks/bersama.js`; web memakai `PUBLIC_SITE_URL` / `PUBLIC_PB_URL`.
- Pengaturan PocketBase produksi (Application URL, trusted proxy, S3, backup, SMTP) diatur lewat `scripts/siapkan-pocketbase.mjs` (idempoten, membaca env), bukan klik manual. Lihat `docs/GO-LIVE.md`.
- Build produksi gagal dengan pesan jelas bila `PUBLIC_PB_URL`/`PUBLIC_SITE_URL` kosong (`web/scripts/cek-env-build.mjs`, dipanggil `prebuild`). Untuk build lokal pakai `BUILD_DEV=1 npm run build`.
- IP klien selalu dari header `CF-Connecting-IP` (trusted proxy); `X-Forwarded-For` dari pengunjung tidak dipercaya. Rate limit (`cekwa.js`) memakai IP ini.
- Route API dari browser selalu lewat `urlApi()` di `web/src/lib/api.ts` (relatif saat dev supaya lewat proxy Vite).
- Link lacak J&T hanya dari `linkLacakJNT()` (`pb_hooks/bersama.js` dan `web/src/lib/lacak.ts`, dijaga sama oleh test).
- Nilai contoh yang wajib diganti sebelum go-live ditandai `TODO(go-live)` (terutama `web/src/config.ts`).
- Sebelum menyatakan selesai: jalankan `npm run build` di `web/`, dan untuk perubahan PocketBase jalankan `docker compose up -d --build` lalu cek `docker compose logs pocketbase`.
- Satu tahap = satu branch atau commit yang rapi, dengan pesan commit Bahasa Indonesia.
