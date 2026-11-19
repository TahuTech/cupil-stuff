export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

// Membuang tag HTML dari field editor PocketBase untuk teks pendek (meta description, kartu).
export const teksPolos = (html = "", maks = 160) => {
  const t = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > maks ? t.slice(0, maks - 1) + "…" : t;
};
