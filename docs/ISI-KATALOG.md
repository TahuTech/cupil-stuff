# Isi Katalog Cupil Stuff

Lengkapi data di bawah untuk setiap produk/jasa. Data ini masuk ke PocketBase
(koleksi `kategori`, `produk`, `varian`, `jasa`, `portofolio`, `zona_ongkir`).
File ini cuma panduan isi; isian finalnya diinput lewat dashboard PocketBase.

> Aturan kode (dipakai banyak tempat): `MDL-` untuk Model 3D, `EDC-` untuk barang EDC,
> dan nomor urut, mis. `MDL-001`, `MDL-002`, `EDC-001`.

---

## 1. Kategori (coleksi `kategori`)

Buat daftar kategori per lini dulu, karena produk merujuk ke kategori.

Untuk **setiap kategori**, jawab:
- **Nama** (tampil di filter): mis. `Figur`, `Keycap`, `Aksesoris`
- **Slug** (untuk URL/katalog): mis. `figur`, `keycap` (huruf kecil, tanpa spasi)
- **Induk / parent** (opsional, bisa kosong)
- **Urutan** (posisi di daftar)

---

## 2. Produk (coleksi `produk`)

Copy blok ini **satu per produk**. Untuk **setiap produk** jawab:

```
PRODUK
- Kode          :                       (mis. MDL-001)
- Nama          :                       (mis. Figur Penguin)
- Lini          : (model3d | edc)       (pilih salah satu)
- Kategori      :                       (slug kategori di atas)
- Deskripsi     :                       (2-5 kalimat: bahan, ukuran, cara pakai)
- Foto utama    :                       1-5 gambar (JPG/PNG/WebP)
- File model 3D :                       (ADA / TIDAK; kalau ada: path .glb)
- Bagian warna  :                       (nama bagian yang bisa diubah warna di 3D, bisa kosong)
- Link marketplace :                    (URL Tokopedia dst, atau KOSONG)

WARNA (opsional; tulis tiap opsi warna)
- Nama warna    :                       (mis. Biru, Putih, Hitam)
- Hex           :                       (mis. #2F5BB5 — kosong jika "warna asli cetakan")

VARIAN (1 atau lebih; harga & stok per varian)
- Varian 1
  - Kode varian :                       (mis. MDL-001-XL)
  - Nama        :                       (mis. Ukuran XL)
  - Harga (Rp)  :
  - Stok        :                       (angka; 0 + preorder = pre-order)
  - Preorder  ? : (ya | tidak)
  - Foto        :                       (opsional, bisa kosong — pakai foto produk)
- Varian 2 (dst) : ...ulangi...
```

Pertanyaan ikhtisar yang harus bisa kamu jawab:
1. Apa saja **produk yang mau dijual** (daftar nama)?
2. Tiap produk: **lini mana** (model3d / edc)?
3. **Kurasi** — mana yang stok siap kirim, mana yang **pre-order**?
4. **Harga jual** tiap varian + **harga minimal** hanya sekali klik?
5. **Foto** tiap produk sudah punya & formatnya?
6. Untuk yang **bisa diputar 3D**: file `.glb` ada & bagian warna apa yang bisa diubah?
7. Ada **link marketplace** yang mau ditampilkan?

---

## 3. Jasa servis (coleksi `jasa`) — tampil di halaman /servis

Untuk **setiap jenis layanan servis**, jawab:
```
- Kode        :              (mis. SRV-M01)
- Nama        :              (mis. Ganti switch mouse)
- Deskripsi   :              (singkat, mis. "Double click / klik mati pada tombol kiri-kanan")
- Harga mulai :              (Rp; angka minimum, mis. 50000)
- Perangkat   : (mouse|keyboard|controller|lainnya)
- Estimasi    :              (mis. 1-2 hari)
- Urutan      :              (urutan tampil)
```
Pertanyaan:
1. Daftar **jenis servis** yang mau ditawarkan (mouse, keyboard, controller, lainnya)?
2. **Harga mulai** dan **estimasi** tiap layanan?
3. Apakah jasa **controller/joystick** perlu harga mulai yang jelas (mis. ganti analog Rp ...)?

### Contoh terisi — "Servis Mouse (per switch)" dari Tokopedia
Harga = harga Tokopedia **setelah admin 8,5%** (net yang diterima).
| Kode | Nama | Deskripsi | Harga | Est. |
|------|------|-----------|------:|------|
| SRV-M11 | Scroll (ganti encoder) | Ganti scroll encoder beserta komponen + jasa | 84000 | 1-2 hari |
| SRV-M12 | Jasa solder switch | Solder & desolder switch bermasalah (tanpa switch pengganti) | 46000 | 1-2 hari |
| SRV-M13 | Paket Silent | Ganti switch + switchnya (KAILH Silent) | 66000 | 1-2 hari |
| SRV-M14 | Paket Durable | Ganti switch + switchnya (KAILH GM8 Black) | 75000 | 1-2 hari |
| SRV-M15 | Custom Switch | Request switch yang tidak ready — dicarikan dulu | 82000 | 1-3 hari |
| SRV-M16 | Side Button | Ganti/perbaiki tombol sisi mouse | 80000 | 1-2 hari |
| SRV-M17 | Ganti Baterai | Ganti baterai mouse | 120000 | 1-4 hari |

> Catatan: harga per **1 switch**; garansi **14 hari** untuk bagian yang diservis, berlaku selama **segel servis tidak rusak/dibuka sendiri**.

### Price list — Controller / Joystick
| Kode | Layanan | Deskripsi | Harga | Est. |
|------|---------|-----------|------:|------|
| SRV-C11 | Ganti joystick (analog) | Jasa ganti joystick, **di luar** biaya komponen | 90000 | 1-3 hari |
| SRV-C12 | Ganti baterai controller | Termasuk komponen baterai | 120000 | 1-4 hari |
| SRV-C13 | Custom service | Perbaikan / modifikasi khusus controller | 75000 | sesuai kasus |

### Price list — Keyboard & Build (partner Jaykeeb)

**Jasa solder**
| Kode | Layanan | Tier | Harga |
|------|---------|------|------:|
| SRV-K11 | Solder switch/hotswap | TKL or Less | 100.000 |
| SRV-K12 | Solder switch/hotswap | More than TKL | 125.000 |
| SRV-K13 | Solder millmax (7305 / 0305) | TKL or Less | 150.000 |
| SRV-K14 | Solder millmax (7305 / 0305) | More than TKL | 200.000 |
| SRV-K15 | Desolder | 60/65 | 150.000 |
| SRV-K16 | Desolder | TKL | 175.000 |
| SRV-K17 | Desolder | Fullsize | 200.000 |
| SRV-K18 | Rework | TKL or Less | 225.000 |
| SRV-K19 | Rework | More than TKL | 250.000 |

**Jasa build (dengan case milikmu)**
| Kode | Stabilizer | Jenis | Tier | Harga |
|------|-----------|-------|------|------:|
| SRV-K21 | sendiri | Hotswap | TKL or Less | 125.000 |
| SRV-K22 | sendiri | Hotswap | More than TKL | 150.000 |
| SRV-K23 | sendiri | Solder | TKL or Less | 150.000 |
| SRV-K24 | sendiri | Solder | More than TKL | 175.000 |
| SRV-K25 | Jaykeeb | Hotswap | TKL or Less | 175.000 |
| SRV-K26 | Jaykeeb | Hotswap | More than TKL | 200.000 |
| SRV-K27 | Jaykeeb | Solder | TKL or Less | 225.000 |
| SRV-K28 | Jaykeeb | Solder | More than TKL | 250.000 |
| SRV-K29 | Tuning stabilizer saja | — | TKL or Less | 75.000 |
| SRV-K30 | Tuning stabilizer saja | — | More than TKL | 100.000 |

**PCB service**
| Kode | Layanan | Harga |
|------|---------|------:|
| SRV-K31 | Jumper PCB | 100.000 (+25.000/jalur tambahan) |
| SRV-K32 | Replace komponen | 75.000 (+25.000/pcs) |
| SRV-K33 | Desolder USB-C socket | 50.000 |
| SRV-K34 | Rework USB-C socket | 75.000 |
| SRV-K35 | Desolder Pro Micro | 100.000 |

**Keunggulan Jaykeeb**: Matrix diuji · komponen defect (underglow / usb-c buruk) diinformasikan.

---

## 4. Portofolio sebelum–sesudah (coleksi `portofolio`) — halaman /hasil-servis

Untuk **setiap entri portofolio**, jawab:
```
- Judul          :      (mis. Ganti switch double click)
- Keterangan     :      (mis. Logitech G102 · klik kiri normal kembali)
- Foto sebelum   :      (file — bisa 1 foto)
- Foto sesudah   :      (file)
```
Pertanyaan:
1. Punya **foto sebelum & sesudah** untuk dipajang?
2. Kalau belum ada contoh foto, mau diisi **nanti** atau **tampilkan tanpa galeri** dulu?

---

## 5. Ongkir (coleksi `zona_ongkir`)

Zona ongkir **sudah ditetapkan** — lihat tabel & rumus di `CLAUDE.md` (bagian **Ongkir J&T EZ dari Surabaya**):

| Zona | Provinsi | Tarif/kg |
|------|----------|--------:|
| Dalam kota | Kota Surabaya | 8.000 |
| Jawa | DKI, Jabar, Banten, Jateng, DIY, Jatim selain Surabaya | 20.000 |
| Bali, NTB, Kalimantan, Sulawesi | Bali, NTB, 5 prov Kalimantan, 6 prov Sulawesi | 35.000 |
| Sumatra | 10 provinsi Sumatra | 50.000 |
| NTT dan Maluku | NTT, Maluku, Maluku Utara | 75.000 |
| Papua | 6 provinsi Papua | 100.000 |

Ikir masuk ke PocketBase `zona_ongkir` mengikuti tabel di atas (nama, provinsi JSON, `tarif_per_kg`, estimasi). Rumus & toleransi berat sudah dihandle aplikasi (lihat `CLAUDE.md`). Tidak ada yang perlu kamu isi kembali.

---

## 6. Config toko (`web/src/config.ts`) — sebelum go-live

- **Nomor WhatsApp** toko (format 62...): `TOKO.nomorWA`
- **Alamat kirim perangkat servis**: `SERVIS.alamatKirim`
- **Info antar/ambil langsung** servis: `SERVIS.infoAntar`
- Nama & URL **marketplace**: `TOKO.marketplace`
- **Teks QRIS** statis pembayaran: env `PUBLIC_QRIS_STATIS`

Pertanyaan:
1. Nomor WhatsApp **aktif** yang dipakai toko?
2. Alamat **kirim balik** servis yang ingin dipublikasikan?
3. Sudah punya **teks QRIS** dari bank/e-wallet?