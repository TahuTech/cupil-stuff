// Keranjang belanja di browser (localStorage).
// Yang disimpan hanya id varian, jumlah, dan warna. Harga, stok, dan berat selalu
// diambil dari data build terbaru (lihat ringkasKeranjang), bukan dari localStorage.

export type ItemKeranjang = { varian: string; jumlah: number; warna: string | null };

/** Data varian dari build, dipakai halaman keranjang. */
export type InfoVarian = {
  id: string;
  kode: string;
  nama: string;
  harga: number;
  beratKirim: number; // gram
  stok: number;
  preorder: boolean;
  produk: { kode: string; nama: string; foto: string | null; jumlahVarian: number; warna: string[] };
};

export const KUNCI = "cupil:keranjang";
export const EVENT_BERUBAH = "keranjang:berubah";
export const MAKS_ITEM = 20; // sama dengan batas di server (pb_hooks/pesanan.js)
export const MAKS_JUMLAH = 99;

// ---------- penyimpanan (localStorage bisa diblokir: selalu try/catch) ----------
export function bacaKeranjang(): ItemKeranjang[] {
  try {
    const data = JSON.parse(localStorage.getItem(KUNCI) || "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter((x) => x && typeof x.varian === "string" && Number.isInteger(x.jumlah) && x.jumlah > 0)
      .map((x) => ({ varian: x.varian, jumlah: Math.min(x.jumlah, MAKS_JUMLAH), warna: typeof x.warna === "string" ? x.warna : null }));
  } catch {
    return [];
  }
}

function simpan(items: ItemKeranjang[]): boolean {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVENT_BERUBAH));
    return true;
  } catch {
    return false;
  }
}

const sama = (a: ItemKeranjang, varian: string, warna: string | null) => a.varian === varian && a.warna === warna;

/** Tambah barang; varian + warna yang sama digabung. Mengembalikan false jika gagal disimpan atau keranjang penuh. */
export function tambahKeKeranjang(item: ItemKeranjang, batas = MAKS_JUMLAH): boolean {
  const items = bacaKeranjang();
  const ada = items.find((x) => sama(x, item.varian, item.warna));
  if (ada) ada.jumlah = Math.min(ada.jumlah + item.jumlah, batas, MAKS_JUMLAH);
  else if (items.length >= MAKS_ITEM) return false;
  else items.push({ ...item, jumlah: Math.min(item.jumlah, batas, MAKS_JUMLAH) });
  return simpan(items);
}

export function ubahJumlah(varian: string, warna: string | null, jumlah: number) {
  const items = bacaKeranjang();
  const ada = items.find((x) => sama(x, varian, warna));
  if (ada) ada.jumlah = Math.max(1, Math.min(Math.floor(jumlah) || 1, MAKS_JUMLAH));
  simpan(items);
}

export function hapusDariKeranjang(varian: string, warna: string | null) {
  simpan(bacaKeranjang().filter((x) => !sama(x, varian, warna)));
}

export function kosongkanKeranjang() {
  simpan([]);
}

export const jumlahBarang = (items = bacaKeranjang()) => items.reduce((n, x) => n + x.jumlah, 0);

// ---------- ringkasan (fungsi murni, punya unit test) ----------
export type BarisKeranjang = ItemKeranjang & {
  info: InfoVarian | null;
  /** jumlah yang dihitung: dibatasi stok kecuali pre-order */
  jumlahDipakai: number;
  status: "ok" | "hilang" | "habis" | "dikurangi";
  subtotal: number;
  berat: number;
};

export function batasStok(info: InfoVarian) {
  return info.preorder ? MAKS_JUMLAH : Math.max(0, info.stok);
}

export function ringkasKeranjang(items: ItemKeranjang[], data: Record<string, InfoVarian>) {
  const baris: BarisKeranjang[] = items.map((item) => {
    const info = data[item.varian] ?? null;
    if (!info) return { ...item, info, jumlahDipakai: 0, status: "hilang", subtotal: 0, berat: 0 };
    const batas = batasStok(info);
    if (batas <= 0) return { ...item, info, jumlahDipakai: 0, status: "habis", subtotal: 0, berat: 0 };
    const jumlahDipakai = Math.min(item.jumlah, batas);
    return {
      ...item,
      info,
      jumlahDipakai,
      status: jumlahDipakai < item.jumlah ? "dikurangi" : "ok",
      subtotal: info.harga * jumlahDipakai,
      berat: info.beratKirim * jumlahDipakai,
    };
  });
  const valid = baris.filter((b) => b.jumlahDipakai > 0);
  return {
    baris,
    /** item yang ikut checkout (yang hilang/habis tidak ikut) */
    untukCheckout: valid.map((b) => ({ varian: b.varian, jumlah: b.jumlahDipakai, warna: b.warna })),
    subtotal: valid.reduce((n, b) => n + b.subtotal, 0),
    beratGram: valid.reduce((n, b) => n + b.berat, 0),
    jumlahBarang: valid.reduce((n, b) => n + b.jumlahDipakai, 0),
  };
}
