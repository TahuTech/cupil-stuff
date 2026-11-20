// Mengambil data katalog dari PocketBase saat build.
// Hasilnya disimpan sementara supaya setiap halaman tidak mengambil ulang.

const PB_URL = (import.meta.env.PUBLIC_PB_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
const CDN_URL = (import.meta.env.PUBLIC_CDN_URL || "").replace(/\/$/, "");

type Rec = { id: string; collectionId: string; collectionName: string; [k: string]: any };

export type Warna = { nama: string; hex: string | null };

export type Kategori = { id: string; nama: string; slug: string; induk: string; urutan: number };

export type Varian = {
  id: string;
  kode: string;
  nama: string;
  harga: number;
  beratKirim: number; // gram
  stok: number;
  preorder: boolean;
  foto: string[]; // URL lengkap
};

export type Produk = {
  id: string;
  kode: string;
  nama: string;
  lini: "model3d" | "edc";
  kategori: Kategori | null;
  deskripsi: string; // HTML dari editor PocketBase
  foto: string[];
  model3d: string | null;
  warna: Warna[];
  bagianWarna: string[];
  linkMarketplace: string;
  varian: Varian[];
  hargaMin: number;
  hargaMax: number;
  tersedia: boolean;
};

export type ZonaOngkir = { id: string; nama: string; provinsi: string[]; tarifPerKg: number; estimasi: string };

// URL file:
// - dev: relatif (/api/files/...), diteruskan proxy Vite ke PocketBase (lihat astro.config.mjs),
//   supaya bisa dibuka dari HP lewat `npm run dev -- --host` walau PocketBase hanya di 127.0.0.1.
// - build: langsung dari R2 (subdomain cdn) jika diatur, kalau tidak lewat PocketBase.
//   PocketBase menyimpan file di bucket dengan pola <collectionId>/<recordId>/<namaFile>.
export const fileUrl = (rec: Rec, nama: string) => {
  const jalur = `${rec.collectionId}/${rec.id}/${encodeURIComponent(nama)}`;
  if (import.meta.env.DEV) return `/api/files/${jalur}`;
  return CDN_URL ? `${CDN_URL}/${jalur}` : `${PB_URL}/api/files/${jalur}`;
};

async function ambilSemua(koleksi: string, query: Record<string, string> = {}): Promise<Rec[]> {
  const hasil: Rec[] = [];
  let halaman = 1;
  while (true) {
    const params = new URLSearchParams({ perPage: "500", page: String(halaman), ...query });
    const res = await fetch(`${PB_URL}/api/collections/${koleksi}/records?${params}`);
    if (!res.ok) {
      throw new Error(`Gagal mengambil ${koleksi} dari PocketBase (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    hasil.push(...data.items);
    if (halaman >= data.totalPages) break;
    halaman++;
  }
  return hasil;
}

let cacheKatalog: Promise<{ kategori: Kategori[]; produk: Produk[] }> | null = null;

export function ambilKatalog() {
  // Saat `npm run dev` modul ini tetap hidup antar-request, jadi tanpa pengecualian ini
  // perubahan di PocketBase baru terlihat setelah dev server di-restart.
  if (import.meta.env.DEV) return muatKatalog();
  cacheKatalog ??= muatKatalog();
  return cacheKatalog;
}

async function muatKatalog() {
  const [kategoriRec, produkRec, varianRec] = await Promise.all([
    ambilSemua("kategori", { sort: "urutan,nama" }),
    ambilSemua("produk", { sort: "kode" }),
    ambilSemua("varian", { sort: "urutan,harga" }),
  ]);

  const kategori: Kategori[] = kategoriRec.map((k) => ({
    id: k.id,
    nama: k.nama,
    slug: k.slug,
    induk: k.induk || "",
    urutan: k.urutan || 0,
  }));
  const kategoriById = new Map(kategori.map((k) => [k.id, k]));

  const varianPerProduk = new Map<string, Varian[]>();
  for (const v of varianRec) {
    const daftar = varianPerProduk.get(v.produk) || [];
    daftar.push({
      id: v.id,
      kode: v.kode,
      nama: v.nama,
      harga: v.harga,
      beratKirim: v.berat_kirim,
      stok: v.stok || 0,
      preorder: !!v.preorder,
      foto: (v.foto || []).map((f: string) => fileUrl(v, f)),
    });
    varianPerProduk.set(v.produk, daftar);
  }

  const produk: Produk[] = produkRec
    .map((p) => {
      const varian = varianPerProduk.get(p.id) || [];
      const harga = varian.map((v) => v.harga);
      return {
        id: p.id,
        kode: p.kode,
        nama: p.nama,
        lini: p.lini,
        kategori: kategoriById.get(p.kategori) || null,
        deskripsi: p.deskripsi || "",
        foto: (p.foto || []).map((f: string) => fileUrl(p, f)),
        model3d: p.model_3d ? fileUrl(p, p.model_3d) : null,
        warna: Array.isArray(p.warna) ? p.warna : [],
        bagianWarna: Array.isArray(p.bagian_warna) ? p.bagian_warna : [],
        linkMarketplace: p.link_marketplace || "",
        varian,
        hargaMin: harga.length ? Math.min(...harga) : 0,
        hargaMax: harga.length ? Math.max(...harga) : 0,
        tersedia: varian.some((v) => v.stok > 0 || v.preorder),
      } satisfies Produk;
    })
    // produk tanpa varian belum bisa dijual (belum ada harga): tidak ditampilkan
    .filter((p) => p.varian.length > 0);

  return { kategori, produk };
}

export async function ambilZonaOngkir(): Promise<ZonaOngkir[]> {
  const rec = await ambilSemua("zona_ongkir", { sort: "urutan" });
  return rec.map((z) => ({
    id: z.id,
    nama: z.nama,
    provinsi: z.provinsi || [],
    tarifPerKg: z.tarif_per_kg,
    estimasi: z.estimasi || "",
  }));
}
