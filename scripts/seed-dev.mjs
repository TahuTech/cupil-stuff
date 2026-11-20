#!/usr/bin/env node
// Data contoh KHUSUS DEVELOPMENT. Jangan jalankan ke PocketBase produksi.
//
//   PB_EMAIL=... PB_PASSWORD=... SEED_GLB=/path/model.glb node scripts/seed-dev.mjs
//
// Env:
//   PB_URL       default http://127.0.0.1:8090
//   PB_EMAIL     email superuser (wajib)
//   PB_PASSWORD  password superuser (wajib)
//   SEED_GLB     path file .glb untuk MDL-001 (opsional; tanpa ini MDL-001 dibuat tanpa model 3D)
//
// Skrip ini bisa dijalankan ulang: data contoh lama (berdasarkan kode/slug) dihapus dulu.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { deflateSync } from "node:zlib";

const PB_URL = (process.env.PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
const { PB_EMAIL, PB_PASSWORD, SEED_GLB } = process.env;

if (!PB_EMAIL || !PB_PASSWORD) {
  console.error("Isi env PB_EMAIL dan PB_PASSWORD (akun superuser PocketBase).");
  process.exit(1);
}

let token = "";

async function api(method, path, body) {
  const headers = { Authorization: token };
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const teks = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${teks}`);
  return teks ? JSON.parse(teks) : null;
}

const cari = (koleksi, filter) =>
  api("GET", `/api/collections/${koleksi}/records?perPage=200&filter=${encodeURIComponent(filter)}`).then((r) => r.items);
const hapus = (koleksi, id) => api("DELETE", `/api/collections/${koleksi}/records/${id}`);
const buat = (koleksi, data) => api("POST", `/api/collections/${koleksi}/records`, data);

// ---------- gambar placeholder (PNG polos, dibuat tanpa dependensi) ----------
const crcTabel = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabel[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tipe, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(tipe), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** PNG 400×400 dengan gradasi diagonal dari warna hex, supaya mudah dibedakan satu sama lain. */
function pngPlaceholder(hex, ukuran = 400) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const baris = ukuran * 3 + 1;
  const raw = Buffer.alloc(baris * ukuran);
  for (let y = 0; y < ukuran; y++) {
    raw[y * baris] = 0; // filter: none
    for (let x = 0; x < ukuran; x++) {
      const t = 0.6 + 0.4 * ((x + y) / (2 * ukuran));
      const o = y * baris + 1 + x * 3;
      raw[o] = r * t;
      raw[o + 1] = g * t;
      raw[o + 2] = b * t;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ukuran, 0);
  ihdr.writeUInt32BE(ukuran, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function form(data, file = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) {
    fd.append(k, typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  }
  for (const [field, daftar] of Object.entries(file)) {
    for (const { nama, isi, tipe } of daftar) fd.append(field, new Blob([isi], { type: tipe }), nama);
  }
  return fd;
}
const foto = (nama, hex) => ({ nama, isi: pngPlaceholder(hex), tipe: "image/png" });

// ---------- mulai ----------
const auth = await api("POST", "/api/collections/_superusers/auth-with-password", {
  identity: PB_EMAIL,
  password: PB_PASSWORD,
});
token = auth.token;
console.log(`Login sebagai ${auth.record.email} di ${PB_URL}`);

// bersihkan data contoh lama (varian ikut terhapus karena cascadeDelete)
for (const p of await cari("produk", `kode ~ "EDC-00" || kode ~ "MDL-00"`)) await hapus("produk", p.id);
for (const k of await cari("kategori", `slug = "pisau" || slug = "figur"`)) await hapus("kategori", k.id);

const pisau = await buat("kategori", { nama: "Pisau", slug: "pisau", urutan: 1 });
const figur = await buat("kategori", { nama: "Figur", slug: "figur", urutan: 2 });
console.log("Kategori: Pisau, Figur");

// EDC-001: 2 varian, satu stok 3, satu habis (bukan pre-order); varian kedua TANPA kode
const edc1 = await buat(
  "produk",
  form(
    {
      kode: "EDC-001",
      nama: "Pisau Lipat Mini",
      lini: "edc",
      kategori: pisau.id,
      deskripsi: "<p>Pisau lipat kecil untuk keperluan sehari-hari. <strong>Data contoh.</strong></p>",
      link_marketplace: "https://example.com/toko/pisau-lipat-mini",
      aktif: true,
      unggulan: true,
    },
    { foto: [foto("edc-001-a.png", "#607d8b"), foto("edc-001-b.png", "#455a64")] },
  ),
);
const v1 = await buat(
  "varian",
  form(
    { produk: edc1.id, kode: "EDC-001-1", nama: "Satin", harga: 150000, berat_kirim: 250, stok: 3, preorder: false, urutan: 1 },
    { foto: [foto("satin.png", "#b0bec5")] },
  ),
);
const v2 = await buat("varian", {
  produk: edc1.id,
  nama: "Black Oxide",
  harga: 175000,
  berat_kirim: 250,
  stok: 0,
  preorder: false,
  urutan: 2,
});
console.log(`EDC-001: varian ${v1.kode} (stok 3), ${v2.kode} (stok 0, kode otomatis)`);

// MDL-001: model 3D + 3 warna (salah satunya hex null = warna asli)
const fileMdl = { foto: [foto("mdl-001.png", "#8d6e63")] };
if (SEED_GLB) {
  fileMdl.model_3d = [{ nama: basename(SEED_GLB), isi: await readFile(SEED_GLB), tipe: "model/gltf-binary" }];
} else {
  console.warn("SEED_GLB kosong: MDL-001 dibuat tanpa model 3D.");
}
const mdl1 = await buat(
  "produk",
  form(
    {
      kode: "MDL-001",
      nama: "Figur Kucing Duduk",
      lini: "model3d",
      kategori: figur.id,
      deskripsi: "<p>Figur cetak 3D. <em>Data contoh.</em></p>",
      warna: [
        { nama: "Asli", hex: null },
        { nama: "Merah", hex: "#e53935" },
        { nama: "Biru", hex: "#1e88e5" },
      ],
      bagian_warna: [],
      aktif: true,
      unggulan: true,
    },
    fileMdl,
  ),
);
const vm = await buat("varian", { produk: mdl1.id, nama: "Tinggi 8 cm", harga: 85000, berat_kirim: 150, stok: 5, urutan: 1 });
console.log(`MDL-001: ${SEED_GLB ? "dengan" : "tanpa"} model 3D, varian ${vm.kode}`);

// EDC-002: tidak aktif, tidak boleh tampil di katalog
const edc2 = await buat("produk", form({ kode: "EDC-002", nama: "Peluit Darurat (draft)", lini: "edc", kategori: pisau.id, aktif: false }));
const ve2 = await buat("varian", { produk: edc2.id, nama: "Standar", harga: 35000, berat_kirim: 100, stok: 10 });
console.log(`EDC-002: aktif = false, varian ${ve2.kode}`);

console.log("Selesai.");
