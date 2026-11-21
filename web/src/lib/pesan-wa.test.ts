// Isi pesan WhatsApp saat server mati (web/src/lib/pesan-wa.ts).
import { describe, expect, it } from "vitest";
import {
  pesanKeranjangWA, pesanServisWA, pesanCekTiketWA, pesanCekPesananWA,
  type PembeliWA,
} from "./pesan-wa";
import type { BarisKeranjang, InfoVarian } from "./keranjang";

function info(over: Partial<InfoVarian> = {}): InfoVarian {
  return {
    id: "v1", kode: "EDC-001-1", nama: "Satin", harga: 150_000, beratKirim: 250, stok: 5, preorder: false,
    produk: { kode: "EDC-001", nama: "Pisau Lipat Mini", foto: null, jumlahVarian: 2, warna: [] },
    ...over,
  };
}

function baris(over: Partial<BarisKeranjang> = {}): BarisKeranjang {
  return {
    varian: "v1", jumlah: 2, warna: null, info: info(), jumlahDipakai: 2, status: "ok",
    subtotal: 300_000, berat: 500, ...over,
  };
}

const pembeli: PembeliWA = {
  nama: "Budi", wa: "081234567890", alamat: "Jl. Contoh No. 1, Bandung", provinsi: "Jawa Barat",
};

describe("pesanKeranjangWA", () => {
  it("memuat barang (kode, nama, varian, warna, jumlah, harga), ongkir, total, dan data pembeli", () => {
    const ps = pesanKeranjangWA(
      [baris({ warna: "Merah", varian: "v2", info: info({ id: "v2", kode: "MDL-001-1", nama: "8 cm", harga: 85_000, produk: { kode: "MDL-001", nama: "Figur Kucing", foto: null, jumlahVarian: 1, warna: ["Merah"] } }), jumlahDipakai: 1, subtotal: 85_000 })],
      pembeli,
      { otomatis: true, beratKg: 1, ongkir: 20_000, potongan: 5_000, total: 100_000 },
      "Cupil Stuff",
    );
    expect(ps).toContain("Halo Cupil Stuff");
    expect(ps).toContain("kode: MDL-001-1");
    expect(ps).toContain("varian: 8 cm");
    expect(ps).toContain("warna: Merah");
    expect(ps).toContain("jumlah: 1");
    expect(ps).toContain("Rp 85.000 × 1 = Rp 85.000");
    expect(ps).toContain("Ongkir J&T (perkiraan 1 kg): Rp 20.000");
    expect(ps).toContain("Potongan ongkir: − Rp 5.000");
    expect(ps).toContain("Perkiraan total: Rp 100.000");
    expect(ps).toContain("Nama: Budi");
    expect(ps).toContain("WhatsApp: 081234567890");
    expect(ps).toContain("Provinsi: Jawa Barat");
    expect(ps).toContain("Alamat: Jl. Contoh No. 1, Bandung");
    expect(ps).toContain("Total dan stok akan dikonfirmasi penjual");
  });

  it("tanpa potongan: baris potongan tidak muncul", () => {
    const ps = pesanKeranjangWA([baris()], pembeli, { otomatis: true, beratKg: 1, ongkir: 8_000, potongan: 0, total: 308_000 }, "Cupil Stuff");
    expect(ps).not.toContain("Potongan ongkir");
    expect(ps).toContain("Perkiraan total: Rp 308.000");
  });

  it("ongkir tidak otomatis: tampil alasan, total + ongkir", () => {
    const ps = pesanKeranjangWA([baris()], pembeli,
      { otomatis: false, beratKg: 6, alasan: "Berat di atas 5 kg, ongkir dikonfirmasi via WhatsApp", total: 300_000 }, "Cupil Stuff");
    expect(ps).toContain("Ongkir: Berat di atas 5 kg. Ongkir dikonfirmasi via WhatsApp");
    expect(ps).toContain("Perkiraan total: Rp 300.000 + ongkir");
  });

  it("barang hilang/habis (jumlahDipakai 0) tidak ikut", () => {
    const ps = pesanKeranjangWA(
      [baris({ status: "habis", jumlahDipakai: 0, subtotal: 0 }), baris({ varian: "v3", info: info({ id: "v3" }) })],
      pembeli,
      { otomatis: true, beratKg: 1, ongkir: 8_000, potongan: 0, total: 308_000 },
      "Cupil Stuff",
    );
    expect(ps.match(/kode:/g)?.length).toBe(1);
  });
});

describe("pesanServisWA", () => {
  const isian = {
    nama: "Sari", wa: "085698765432", perangkat_jenis: "keyboard", perangkat: "Keychron K2",
    keluhan: "Beberapa tombol tidak berfungsi", cara_kirim: "kurir", provinsi: "Bali", jasa: "",
  };

  it("memuat data isian, cara kirim, dan catatan foto dikirim di chat", () => {
    const ps = pesanServisWA(isian, 2, "Cupil Stuff");
    expect(ps).toContain("Halo Cupil Stuff");
    expect(ps).toContain("Perangkat: Keyboard — Keychron K2");
    expect(ps).toContain("Keluhan: Beberapa tombol tidak berfungsi");
    expect(ps).toContain("Nama: Sari");
    expect(ps).toContain("WhatsApp: 085698765432");
    expect(ps).toContain("Cara kirim: Kirim lewat kurir");
    expect(ps).toContain("Provinsi kirim balik: Bali");
    expect(ps).toContain("Foto kondisi perangkat (2) dikirim di chat ini.");
    expect(ps).not.toContain("Nomor tiket");
  });

  it("antar langsung: tidak menyebut provinsi; tanpa foto", () => {
    const ps = pesanServisWA({ ...isian, cara_kirim: "antar", provinsi: "" }, 0, "Cupil Stuff");
    expect(ps).toContain("Cara kirim: Antar langsung");
    expect(ps).not.toContain("Provinsi kirim balik");
    expect(ps).toContain("Belum ada foto");
  });

  it("jasa belum dipilih: disebut belum tahu / tanya dulu", () => {
    expect(pesanServisWA(isian, 0, "Cupil Stuff")).toContain("Jenis servis: belum tahu / ingin tanya dulu");
    // jasa dipilih: nama jasa ditulis, bukan sekadar "sudah dipilih"
    expect(pesanServisWA({ ...isian, jasa: "abcde12345fghij" }, 0, "Cupil Stuff", "Ganti switch mouse")).toContain("Jenis servis: Ganti switch mouse");
  });
});

describe("pesanCekTiketWA & pesanCekPesananWA", () => {
  it("menyertakan nomor yang diketik", () => {
    expect(pesanCekTiketWA("SRV-260101-ABCD", "Cupil Stuff")).toContain("SRV-260101-ABCD");
    expect(pesanCekTiketWA("SRV-260101-ABCD", "Cupil Stuff")).toContain("pengecekan tiket sedang tidak tersedia");
    expect(pesanCekPesananWA("CS-260101-ABCD", "Cupil Stuff")).toContain("CS-260101-ABCD");
    expect(pesanCekPesananWA("CS-260101-ABCD", "Cupil Stuff")).toContain("pengecekan pesanan sedang tidak tersedia");
  });
  it("nomor kosong tetap aman", () => {
    expect(pesanCekTiketWA("", "Cupil Stuff")).toContain("(belum diisi)");
    expect(pesanCekPesananWA("", "Cupil Stuff")).toContain("(belum diisi)");
  });
});