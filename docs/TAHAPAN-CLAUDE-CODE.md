# Tahapan pengerjaan Cupil Stuff dengan Claude Code

Panduan ini berisi prompt siap tempel untuk setiap tahap. Konteks proyek (stack, data, aturan ongkir, konvensi) ada di **CLAUDE.md**, yang dibaca otomatis oleh Claude Code setiap kali dibuka di folder repo. Karena itu, prompt di bawah cukup menyebut tugasnya saja.

## Cara pakai

1. Taruh `CLAUDE.md` di folder utama repo.
2. Untuk setiap tahap:
   - Mulai sesi baru (`/clear`) supaya konteks tahap sebelumnya tidak terbawa.
   - Masuk **plan mode** (Shift+Tab sampai muncul "plan mode"), lalu tempel prompt tahapnya.
   - Baca rencana yang dibuat Claude Code. Koreksi kalau ada yang tidak sesuai, lalu setujui.
   - Setelah selesai, cek sendiri dengan **Cara cek** di tiap tahap, lalu minta Claude Code membuat commit.
3. Jangan lompat tahap. Setiap tahap mengandalkan tahap sebelumnya.

| Tahap | Isi | Butuh domain? |
| --- | --- | --- |
| 0 | Persiapan repo | Tidak |
| 1 | PocketBase: Docker, skema, data zona ongkir | Tidak |
| 2 | Katalog barang: halaman katalog, halaman produk, pesan via WA | Tidak |
| 3 | Keranjang, ongkir, checkout, QRIS | Tidak |
| 4 | Konfirmasi bayar dan stok di admin | Tidak |
| 5 | Jasa servis: daftar jasa, form, tiket, cek status | Tidak |
| 6 | Go-live: domain, Pages, Tunnel, R2, backup | **Ya** |
| 7 | Rapikan: SEO, halaman info, performa | Ya |

---

## Tahap 0: Persiapan repo

```
Siapkan repo untuk proyek Cupil Stuff sesuai CLAUDE.md.

- git init (kalau belum), buat .gitignore (node_modules, dist, .astro, .env, pocketbase/pb_data)
- buat struktur folder: pocketbase/ (Dockerfile, pb_migrations, pb_hooks) dan web/ (proyek Astro kosong, TypeScript strict)
- buat .env.example di root dan di web/
- buat README.md singkat berisi cara menjalankan dev

Jika folder ini sudah berisi kode awal (dari cupil-stuff.zip), jangan buat ulang:
review dulu, sesuaikan dengan CLAUDE.md, dan laporkan apa saja yang kamu ubah.

Jangan isi fitur dulu. Akhiri dengan commit "chore: persiapan repo".
```

**Cara cek:** `git log` menampilkan satu commit, dan `cd web && npm run dev` membuka halaman kosong Astro.

---

## Tahap 1: PocketBase (fondasi data)

```
Kerjakan tahap 1: PocketBase di Docker dengan skema lengkap.

1. pocketbase/Dockerfile: alpine, unduh rilis PocketBase sesuai ARG PB_VERSION (kunci di 0.40.x terbaru)
   dan TARGETARCH (amd64/arm64). Serve dengan --dir, --migrationsDir, --hooksDir.
2. docker-compose.yml: service pocketbase (port hanya 127.0.0.1:8090, volume pb_data/pb_migrations/pb_hooks)
   dan service cloudflared (token dari .env). cloudflared boleh tidak jalan dulu kalau token kosong.
3. Migrasi untuk SEMUA koleksi di CLAUDE.md, lengkap dengan aturan akses, index unik
   (kode produk, kode varian, slug kategori, nomor pesanan, nomor tiket), dan validasi pola kode.
   pesanan dan tiket_servis: createRule null (dibuat lewat route khusus di tahap 3 dan 5).
4. Migrasi data awal: 6 zona ongkir beserta daftar provinsinya (lengkap 38 provinsi).
   Kota Surabaya jadi pilihan tersendiri, di luar provinsi Jawa Timur.
5. Hook: kode varian otomatis "<kode produk>-<n>" jika kosong.
6. Hook: setiap create/update/delete di kategori, produk, varian, zona_ongkir, jasa, portofolio
   memanggil deploy hook Cloudflare Pages (URL dari env PAGES_DEPLOY_HOOK). Lewati jika kosong,
   dan beri jeda minimal 60 detik antarpemanggilan.

Pastikan sintaks migrasi dan hook sesuai versi PocketBase yang dipakai (cek dokumentasi
resmi versi itu, jangan pakai gaya lama sebelum v0.23).

Uji: docker compose up -d --build pocketbase, cek log tidak ada error migrasi, buat superuser,
lalu buat 1 kategori, 1 produk, dan 2 varian (salah satunya tanpa kode) lewat API
dan pastikan kode varian terisi otomatis.
```

**Cara cek:** buka `http://127.0.0.1:8090/_/`. Semua koleksi harus ada, 6 zona ongkir terisi, dan produk dengan `aktif` tidak dicentang tidak muncul di `/api/collections/produk/records` tanpa login.

---

## Tahap 2: Katalog barang

```
Kerjakan tahap 2: katalog Astro yang mengambil data dari PocketBase saat build.

1. web/src/lib/pb.ts: ambil kategori, produk, varian (dengan paging, perPage 500) dari
   PUBLIC_PB_URL, gabungkan varian ke produknya, buang produk tanpa varian.
   URL file: pakai PUBLIC_CDN_URL/<collectionId>/<recordId>/<file> jika diisi,
   kalau tidak /api/files/... dari PocketBase. Cache supaya satu build cukup satu kali ambil.
2. Halaman katalog (/katalog; dulu beranda, kini / adalah landing page): pencarian (kode/nama), filter lini (Model 3D / EDC) dan kategori,
   grid kartu produk (foto, kode, nama, rentang harga, label 3D, label stok habis, titik warna).
   Pencarian dan filter berjalan di browser tanpa reload.
3. Halaman /produk/[kode]:
   - galeri foto (foto varian terpilih tampil duluan, thumbnail bisa diklik)
   - tab 3D jika ada model_3d: model-viewer (camera-controls, auto-rotate, AR) dan ganti warna
     sesuai field warna/bagian_warna (hex null = warna asli; tampilkan nama material di console)
   - pilihan varian (varian habis dan bukan pre-order dinonaktifkan), harga, label stok/pre-order
   - jumlah (dibatasi stok kecuali pre-order)
   - tombol "Pesan via WhatsApp" dengan pesan terisi (produk, kode varian, varian, warna, jumlah,
     harga, link halaman) dan tombol "Beli di marketplace" jika ada link
   - deskripsi, meta description, og:image
4. Tampilan rapi di HP (mulai dari lebar 360px), warna netral, tanpa framework CSS berat.
5. Nomor WhatsApp dan nama toko di web/src/config.ts.

Uji dengan data percobaan di PocketBase lokal: minimal 1 produk EDC dengan 2 varian
(satu stok 0), dan 1 produk model 3D dengan file .glb dan 3 warna.
Jalankan npm run build dan pastikan tidak ada error.
```

**Cara cek:** di `npm run dev`, cari produk berdasarkan kode, ganti varian (foto dan harga ikut berubah), ganti warna model 3D, lalu tekan tombol WhatsApp dan pastikan isi pesannya benar. Coba juga di HP.

---

## Tahap 3: Keranjang, ongkir, checkout, QRIS

```
Kerjakan tahap 3: keranjang, ongkir flat per zona, checkout, dan QRIS nominal otomatis.

A. Keranjang (browser)
   - simpan di localStorage (bungkus try/catch), ikon keranjang dengan jumlah barang di header
   - tombol "Masukkan keranjang" di halaman produk (varian + warna + jumlah)
   - halaman /keranjang: ubah jumlah, hapus, subtotal

B. Ongkir
   - web/src/lib/ongkir.ts: beratDitagihKg (toleransi 0,3 kg, minimal 1 kg), potonganOngkir
     (Rp5.000 per kelipatan Rp100.000, maksimal sebesar ongkir), hitungOngkir (lebih dari 5 kg = tidak otomatis)
   - unit test (vitest) dengan contoh dari CLAUDE.md, termasuk 1.300 g, 1.400 g, 2.300 g, 2.310 g, dan di atas 5 kg
   - di /keranjang: pilih provinsi (dan "Kota Surabaya"), tampilkan zona, estimasi, ongkir,
     potongan, total. Data zona diambil saat build.

C. Checkout (server, PocketBase)
   - route POST /api/checkout di pb_hooks: terima item (id varian + jumlah + warna), data pembeli
     (nama, WA, alamat lengkap, provinsi). HITUNG ULANG di server: harga dari varian, cek stok
     dan status aktif, berat, zona, ongkir, potongan, total. Jangan percaya angka dari browser.
   - simpan ke koleksi pesanan dengan nomor unik, misalnya CS-YYMMDD-XXXX, status_bayar menunggu
   - balas dengan nomor pesanan dan total
   - batasi penyalahgunaan: validasi panjang input dan nomor WA, tolak lebih dari 20 item
   - lebih dari 5 kg atau zona tidak ditemukan: tetap simpan pesanan, tapi tandai ongkir perlu
     konfirmasi dan jangan tampilkan QRIS
   - modul hitungan ongkir di hook harus menghasilkan angka yang SAMA dengan web/src/lib/ongkir.ts;
     buat test yang membandingkan keduanya

D. QRIS nominal otomatis (browser)
   - teks QRIS statis toko disimpan di config (PUBLIC_QRIS_STATIS)
   - fungsi qrisDenganNominal(qris, total): ubah tag 01 dari "11" ke "12", hapus tag 54 lama,
     sisipkan tag 54 berisi total (tanpa desimal) sebelum tag 58, hapus tag 63 lalu hitung ulang
     CRC16-CCITT (init 0xFFFF, poly 0x1021) atas seluruh string termasuk "6304", 4 digit hex kapital
   - unit test: CRC "123456789" = 29B1, struktur TLV tetap valid, nominal terbaca kembali
   - halaman sukses: nomor pesanan, rincian, gambar QR (library kecil, di-bundle), dan tombol
     "Kirim bukti bayar via WhatsApp" dengan pesan berisi nomor pesanan dan total

E. Maskot
   - saat barang berhasil masuk keranjang, panggil maskotSenang() dari web/src/lib/maskot.ts
     (aman walau tidak ada maskot di halaman)
   - halaman sukses: tampilkan maskot kecil dengan ekspresi senang, <Maskot ukuran={96} senangSaatMuncul />

Uji alur penuh: tambah 2 barang, pilih provinsi, checkout, cek pesanan masuk di admin
dengan total yang benar, dan scan QR dengan aplikasi bank/e-wallet (CUKUP SAMPAI LAYAR
KONFIRMASI, jangan dibayar) untuk memastikan nama toko dan nominal benar.
```

**Cara cek:** total di layar sama dengan total di admin PocketBase. Saat QR di-scan dengan minimal 2 aplikasi berbeda (misalnya m-banking dan e-wallet), nominal langsung terisi dan nama merchant sesuai.

---

## Tahap 4: Konfirmasi bayar dan stok

```
Kerjakan tahap 4: alur admin setelah customer membayar.

- hook: saat status_bayar pesanan berubah menjadi lunas, kurangi stok setiap varian sesuai
  jumlahnya, dalam satu transaksi. Jika stok tidak cukup, batalkan perubahan dan beri pesan
  error yang jelas di admin. Jika status kembali dari lunas ke batal, kembalikan stok.
- pre-order tidak mengurangi stok di bawah 0
- nomor resi dan status_kirim bisa diisi di admin; siapkan tautan "Kirim info resi via WhatsApp"
  (route sederhana atau cukup instruksi di README, pilih yang paling sederhana)
- unit/integration test untuk pengurangan dan pengembalian stok
- README: cara memproses pesanan langkah demi langkah untuk pemilik toko
```

**Cara cek:** ubah satu pesanan menjadi `lunas`, lalu pastikan stok varian berkurang dan katalog ter-build ulang dengan stok baru.

---

## Tahap 5: Jasa servis

```
Kerjakan tahap 5: halaman jasa servis.

- /servis (sekarang masih placeholder "segera hadir"): daftar jasa (nama, perangkat, harga mulai dari, estimasi), portofolio sebelum/sesudah,
  penjelasan aturan (tanpa DP, bayar setelah selesai, cek gratis, batal hanya bayar ongkir kirim
  balik, boleh antar langsung)
- form servis: jasa, perangkat, keluhan, foto (maks 5, dikecilkan di browser sebelum upload),
  nama, WA, cara kirim (kurir / antar langsung). Kirim ke route POST /api/servis di pb_hooks.
  Validasi di server, buat nomor tiket unik (misalnya SRV-YYMMDD-XXXX), status menunggu_perangkat.
- halaman sukses: nomor tiket, alamat kirim atau antar (dari config), tombol WhatsApp berisi nomor tiket
- /cek-tiket: masukkan nomor tiket dan 4 digit terakhir nomor WA, lalu panggil route
  GET /api/tiket/{nomor}?wa=XXXX. Route ini hanya mengembalikan status, jasa, estimasi biaya,
  dan tanggal, tanpa data pribadi lain.
- di status menunggu_persetujuan dan selesai, tampilkan nominal, plus QRIS nominal otomatis saat selesai
- ongkir kirim balik: pakai zona yang sama dengan berat bawaan per jenis perangkat (atur di config)
```

**Cara cek:** buat tiket, ubah statusnya dari admin, lalu cek dari halaman `/cek-tiket`. Nomor tiket dengan 4 digit WA yang salah harus ditolak.

---

## Tahap 6: Go-live (setelah domain dibeli)

Sebagian langkah tahap ini dikerjakan di dashboard Cloudflare. Claude Code membantu menyiapkan checklist, file konfigurasi, dan cara mengujinya.

```
Kerjakan tahap 6: siapkan go-live. Domain: <isi domain>.

Buat docs/GO-LIVE.md berisi checklist langkah demi langkah (yang manual di dashboard ditandai)
lalu siapkan file yang dibutuhkan:
- R2: bucket khusus Cupil Stuff, R2 API token khusus bucket itu, custom domain cdn.<domain>,
  CORS untuk <domain> dan localhost; pengaturan S3 dan backup harian di PocketBase (simpan 7)
- Tunnel: api.<domain> → http://pocketbase:8090; Cloudflare Access untuk /_/
- Cloudflare Pages: root web, build npm run build, output dist, env PUBLIC_*; deploy hook ke .env homelab
- PocketBase: atur Application URL, batasi CORS API ke <domain>
- skrip scripts/cek-produksi.sh: cek katalog, cdn, dan api merespons; api /_/ meminta login Access
- uji: matikan container pocketbase dan pastikan katalog, foto, dan 3D tetap terbuka
```

**Cara cek:** jalankan skrip cek produksi, lalu uji dengan `docker compose stop pocketbase` dan pastikan katalog tetap bisa dibuka. Setelah itu nyalakan lagi.

---

## Tahap 7: Rapikan (opsional)

```
Kerjakan tahap 7: rapikan katalog untuk dipakai publik.

- sitemap.xml, robots.txt, favicon, og:image per produk
- halaman /info: cara pesan, ongkir per zona (tabel 6 zona dari data zona), garansi/retur, kontak;
  tautkan dari bagian "Pengiriman" di landing page
- gambar: lazy-load, ukuran sesuai, cek skor Lighthouse di HP (target performa di atas 90)
- aksesibilitas dasar: label tombol, kontras, navigasi keyboard
- halaman 404 dengan pencarian
```

---

## Tips

- **Satu tahap, satu sesi.** Mulai setiap tahap dengan `/clear`, karena CLAUDE.md sudah membawa konteks proyek.
- **Kalau Claude Code ragu soal API PocketBase**, minta ia membaca dokumentasi versi yang dipakai. Jangan biarkan ia menebak, karena API JS-nya berubah besar di v0.23.
- **Jangan beri token asli ke Claude Code.** Isi `.env` sendiri. Claude Code cukup tahu nama variabelnya.
- **Kalau ada keputusan baru** (tarif berubah, aturan servis berubah), perbarui CLAUDE.md dulu, baru minta perubahan kode.
- **Kode awal** di `cupil-stuff.zip` sudah mencakup sebagian besar tahap 1 dan 2. Ekstrak ke repo sebelum tahap 0, lalu biarkan Claude Code mereview dan mengujinya. Cara itu lebih cepat daripada mulai dari nol.
