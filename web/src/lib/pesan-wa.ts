// Isi pesan WhatsApp saat server (PocketBase) tidak bisa dihubungi.
// Fungsi murni (tanpa DOM) supaya bisa diuji; halaman tinggal memanggil lalu buka linkWA.
// Dipakai keranjang.astro (mode WA) dan servis.astro (mode WA).

import { rupiah } from "./format";
import type { BarisKeranjang } from "./keranjang";
import type { IsianServis } from "./servis";
import { LABEL_PERANGKAT, LABEL_CARA_KIRIM } from "./servis";

export type PembeliWA = { nama: string; wa: string; alamat: string; provinsi: string };

export type OngkirWA =
  | { otomatis: true; beratKg: number; ongkir: number; potongan: number; total: number }
  | { otomatis: false; beratKg: number; alasan: string; total: number };

/**
 * Pesan WA untuk pesanan keranjang saat server mati.
 * Berisi daftar barang, ongkir perkiraan, total perkiraan, data pembeli, dan catatan
 * bahwa total + stok akan dikonfirmasi penjual.
 */
export function pesanKeranjangWA(baris: BarisKeranjang[], pembeli: PembeliWA, ongkir: OngkirWA, toko: string): string {
  const daftar = baris
    .filter((b) => b.jumlahDipakai > 0 && b.info)
    .map((b) => {
      const info = b.info!;
      const bagian = [
        `• ${info.produk.nama}`,
        `  kode: ${info.kode}`,
        `  varian: ${info.nama}`,
        b.warna ? `  warna: ${b.warna}` : "",
        `  jumlah: ${b.jumlahDipakai}`,
        `  harga: ${rupiah(info.harga)} × ${b.jumlahDipakai} = ${rupiah(b.subtotal)}`,
      ].filter(Boolean);
      return bagian.join("\n");
    })
    .join("\n\n");

  const subtotal = baris.reduce((n, b) => n + (b.jumlahDipakai > 0 ? b.subtotal : 0), 0);

  const barisOngkir = ongkir.otomatis
    ? [
        `• Ongkir J&T (perkiraan ${ongkir.beratKg} kg): ${rupiah(ongkir.ongkir)}`,
        ongkir.potongan ? `• Potongan ongkir: − ${rupiah(ongkir.potongan)}` : "",
      ].filter(Boolean)
    : [`• Ongkir: ${ongkir.alasan.replace(/, ongkir/, ". Ongkir")}`];

  return [
    `Halo ${toko}, saya mau pesan (lewat WhatsApp karena pemesanan otomatis sedang istirahat).`,
    "",
    "Barang:",
    daftar,
    "",
    `Subtotal: ${rupiah(subtotal)}`,
    ...barisOngkir,
    `Perkiraan total: ${ongkir.otomatis ? rupiah(ongkir.total) : `${rupiah(ongkir.total)} + ongkir`}`,
    "",
    "Data pengiriman:",
    `• Nama: ${pembeli.nama}`,
    `• WhatsApp: ${pembeli.wa}`,
    `• Provinsi: ${pembeli.provinsi}`,
    `• Alamat: ${pembeli.alamat}`,
    "",
    "Total dan stok akan dikonfirmasi penjual. Mohon info ketersediaan dan total akhirnya, ya.",
  ].join("\n");
}

/** Pesan WA untuk permintaan servis saat server mati (tanpa nomor tiket). */
export function pesanServisWA(isian: IsianServis, jumlahFoto: number, toko: string, namaJasa = ""): string {
  const kirim = LABEL_CARA_KIRIM[isian.cara_kirim] || isian.cara_kirim;
  const jenis = LABEL_PERANGKAT[isian.perangkat_jenis] || isian.perangkat_jenis;
  return [
    `Halo ${toko}, saya mau ajukan servis (lewat WhatsApp karena pemesanan otomatis sedang istirahat).`,
    "",
    `• Jenis servis: ${isian.jasa ? namaJasa || "sudah dipilih di form" : "belum tahu / ingin tanya dulu"}`,
    `• Perangkat: ${jenis} — ${isian.perangkat}`,
    `• Keluhan: ${isian.keluhan}`,
    `• Nama: ${isian.nama}`,
    `• WhatsApp: ${isian.wa}`,
    `• Cara kirim: ${kirim}`,
    isian.cara_kirim === "kurir" && isian.provinsi ? `• Provinsi kirim balik: ${isian.provinsi}` : "",
    "",
    jumlahFoto > 0
      ? `Foto kondisi perangkat (${jumlahFoto}) dikirim di chat ini.`
      : "Belum ada foto; nanti saya kirim di chat ini bila perlu.",
    "",
    "Mohon konfirmasi apakah servis bisa dikerjakan dan estimasi biayanya.",
  ]
    .filter((baris) => baris !== "")
    .join("\n");
}

/** Pesan WA saat /cek-tiket tidak bisa mengecek (server mati). */
export function pesanCekTiketWA(nomor: string, toko: string): string {
  return `Halo ${toko}, pengecekan tiket sedang tidak tersedia. Nomor tiket saya: ${nomor || "(belum diisi)"}. Mohon dibantu cek statusnya.`;
}

/** Pesan WA saat /bayar tidak bisa mengecek (server mati). */
export function pesanCekPesananWA(nomor: string, toko: string): string {
  return `Halo ${toko}, pengecekan pesanan sedang tidak tersedia. Nomor pesanan saya: ${nomor || "(belum diisi)"}. Mohon dibantu cek status pembayarannya.`;
}
