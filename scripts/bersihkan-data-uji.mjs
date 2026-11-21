#!/usr/bin/env node
// Hapus SEMUA pesanan dan tiket servis di PocketBase LOKAL (data uji development).
// Katalog (kategori, produk, varian, jasa, portofolio) dan zona ongkir tidak disentuh.
//
//   PB_EMAIL=... PB_PASSWORD=... node scripts/bersihkan-data-uji.mjs
//
// Pengaman:
// - hanya mau berjalan ke PocketBase di localhost / 127.0.0.1 (bukan produksi)
// - menampilkan jumlah dan contoh data, lalu meminta konfirmasi dengan mengetik HAPUS
// Catatan: menghapus pesanan tidak mengembalikan stok. Jalankan seed-dev.mjs jika stok contoh perlu diulang.

import { createInterface } from "node:readline/promises";

const PB_URL = (process.env.PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
const { PB_EMAIL, PB_PASSWORD } = process.env;
const KOLEKSI = [
  { nama: "pesanan", label: "pesanan" },
  { nama: "tiket_servis", label: "tiket servis" },
];

const host = new URL(PB_URL).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`Ditolak: ${PB_URL} bukan PocketBase lokal. Skrip ini hanya untuk data uji di komputer sendiri.`);
  process.exit(1);
}
if (!PB_EMAIL || !PB_PASSWORD) {
  console.error("Isi env PB_EMAIL dan PB_PASSWORD (akun superuser PocketBase lokal).");
  process.exit(1);
}

let token = "";
async function api(method, path, body) {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: { Authorization: token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const teks = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${teks}`);
  return teks ? JSON.parse(teks) : null;
}

async function semuaId(koleksi) {
  const hasil = [];
  for (let hal = 1; ; hal++) {
    const r = await api("GET", `/api/collections/${koleksi}/records?perPage=500&page=${hal}&fields=id,nomor&sort=created`);
    hasil.push(...r.items);
    if (hal >= r.totalPages) break;
  }
  return hasil;
}

token = (await api("POST", "/api/collections/_superusers/auth-with-password", { identity: PB_EMAIL, password: PB_PASSWORD })).token;

const data = [];
for (const k of KOLEKSI) data.push({ ...k, record: await semuaId(k.nama) });

console.log(`PocketBase lokal: ${PB_URL}`);
for (const d of data) {
  const contoh = d.record.slice(0, 3).map((r) => r.nomor).join(", ");
  console.log(`- ${d.record.length} ${d.label}${d.record.length ? ` (mis. ${contoh}${d.record.length > 3 ? ", …" : ""})` : ""}`);
}
const total = data.reduce((n, d) => n + d.record.length, 0);
if (!total) {
  console.log("Tidak ada data uji. Selesai.");
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const jawab = (await rl.question(`Hapus ${total} record di atas? Ketik HAPUS untuk lanjut: `)).trim();
rl.close();
if (jawab !== "HAPUS") {
  console.log("Dibatalkan. Tidak ada yang dihapus.");
  process.exit(0);
}

for (const d of data) {
  for (const r of d.record) await api("DELETE", `/api/collections/${d.nama}/records/${r.id}`);
  console.log(`Terhapus: ${d.record.length} ${d.label}`);
}
console.log("Selesai.");
