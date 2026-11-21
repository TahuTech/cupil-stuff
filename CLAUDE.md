# Cupil Stuff — katalog online

Toko online milik sendiri untuk Cupil Stuff (Surabaya): model 3D buatan sendiri, barang EDC (pisau, peluit, dan sejenisnya), serta jasa servis mouse dan keyboard mechanical. Tujuannya: customer bisa melihat produk, memilih varian, menghitung ongkir, dan membayar lewat QRIS tanpa harus bertanya dulu via WhatsApp.

Biaya rutin harus tetap praktis hanya domain. Jangan menambah layanan berbayar, API kurir, atau payment gateway tanpa diminta.

## Stack

| Bagian | Pilihan |
| --- | --- |
| Katalog | Astro (output statis), di-deploy ke Cloudflare Pages |
| CMS + database | PocketBase **v0.40.x** (JS hooks dan migrations gaya v0.23+), berjalan di Docker di homelab |
| Akses dari internet | Cloudflare Tunnel (`cloudflared` di docker compose); tanpa port forwarding |
| File (foto, .glb) dan backup | Cloudflare R2 lewat pengaturan S3 PocketBase; katalog memuat file dari `cdn.<domain>` |
| 3D | `<model-viewer>` dari Google (CDN), ganti warna lewat `material.pbrMetallicRoughness.setBaseColorFactor` |
| Pembayaran | QRIS statis toko yang nominalnya disisipkan di browser; konfirmasi manual oleh pemilik |
| Kurir | J&T EZ, tarif flat per zona (tanpa API) |

Subdomain: `<domain>` (katalog), `cdn.<domain>` (R2 publik), `api.<domain>` (PocketBase lewat Tunnel), dan panel admin `api.<domain>/_/` yang dikunci dengan Cloudflare Access.

Prinsip arsitektur: **katalog, foto, dan 3D harus tetap bisa dibuka walaupun homelab mati.** Hanya pesanan baru, cek tiket, dan admin yang boleh bergantung ke homelab.

## Struktur repo

```
docker-compose.yml          pocketbase + cloudflared
pocketbase/Dockerfile       unduh rilis PocketBase sesuai PB_VERSION dan TARGETARCH
pocketbase/pb_migrations/   skema + data awal (zona ongkir)
pocketbase/pb_hooks/        hook dan route khusus (*.pb.js); kode bersama lewat require(`${__hooks}/x.js`)
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
| `/servis` | Jasa servis (placeholder "segera hadir" sampai tahap 5) |
| `/404` | Halaman tidak ditemukan dengan maskot |

Link "kembali ke katalog" selalu ke `/katalog`, bukan `/`.

Build memakai `build.format: "file"` (`/katalog` → `katalog.html`). Route API khusus: `POST /api/checkout` (`pb_hooks/checkout.pb.js`), `GET /api/pesanan/{nomor}?wa=XXXX` (`pb_hooks/pesanan.api.pb.js`); CORS diatur lewat `PB_ORIGINS` (flag `--origins` di compose).

## Data (koleksi PocketBase)

- `kategori`: nama, slug, induk (relasi ke diri sendiri), urutan
- `produk`: kode unik (`MDL-001`, `EDC-001`), nama, lini (`model3d` | `edc`), kategori, deskripsi (editor), foto[], model_3d (.glb, opsional), warna (JSON `[{nama, hex|null}]`), bagian_warna (JSON nama material), link_marketplace, aktif, unggulan (bool; tampil di "Produk pilihan" landing page, maks. 4, jika tidak ada pakai 4 produk terbaru)
- `varian`: produk, kode unik (otomatis `<kode produk>-<n>` jika kosong), nama, harga, berat_kirim (gram), stok, preorder, foto[], urutan. **Setiap produk minimal punya 1 varian.** Harga, berat, dan stok selalu ada di varian.
- `zona_ongkir`: nama, provinsi (JSON), tarif_per_kg, estimasi, urutan
- `pesanan`: nomor (`CS-YYMMDD-XXXX`), items (JSON), pembeli, wa (`628…`), alamat, provinsi, zona, berat_gram, berat_ditagih_kg, subtotal, ongkir, potongan_ongkir, total, ongkir_konfirmasi (bool: di atas 5 kg atau zona tidak ditemukan; total = subtotal dan QRIS tidak ditampilkan), status_bayar (`menunggu` | `lunas` | `batal`), status_kirim, resi
- `jasa`: kode (`SRV-001`), nama, perangkat, deskripsi, harga_mulai, estimasi, aktif
- `tiket_servis`: nomor, jasa, nama, wa, perangkat, keluhan, foto[], cara_kirim (`kurir` | `antar`), estimasi_biaya, biaya_final, status
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
- Ongkir kirim balik memakai tabel zona yang sama.

## Konvensi

- Teks antarmuka dalam **Bahasa Indonesia** yang ramah dan singkat. Format uang `Rp 150.000`.
- Komentar kode boleh Bahasa Indonesia.
- Jangan simpan rahasia (token Tunnel, kunci R2, deploy hook) di repo. Pakai `.env` (sudah di `.gitignore`) dan `.env.example`.
- Kunci versi PocketBase di Dockerfile atau compose. Jangan pakai `latest` untuk PocketBase.
- Hook PocketBase: handler berjalan terpisah, jadi variabel di luar handler tidak bisa dibaca. Kode bersama ditaruh di modul dan dipanggil dengan `require()`.
- Setiap logika hitungan (ongkir, potongan, total, nominal QRIS, CRC) harus punya unit test.
- Hitungan ongkir ada di dua tempat: `web/src/lib/ongkir.ts` dan `pocketbase/pb_hooks/ongkir.js`. Ubah keduanya bersamaan; `ongkir-hook.test.ts` memastikan hasilnya sama.
- Isi `PUBLIC_QRIS_STATIS` jangan pernah ditampilkan atau dicatat di log, laporan, maupun commit.
- Sebelum menyatakan selesai: jalankan `npm run build` di `web/`, dan untuk perubahan PocketBase jalankan `docker compose up -d --build` lalu cek `docker compose logs pocketbase`.
- Satu tahap = satu branch atau commit yang rapi, dengan pesan commit Bahasa Indonesia.
