// QRIS statis → QRIS dengan nominal (dinamis), dibuat di browser.
// Format QRIS: rangkaian TLV (Tag 2 digit, panjang 2 digit, nilai), diakhiri tag 63 (CRC).
// Jangan pernah mencatat isi QRIS toko ke console/log.

export type TLV = { tag: string; nilai: string };

/** CRC16-CCITT (init 0xFFFF, poly 0x1021), 4 digit hex kapital. */
export function crc16(teks: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(teks)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Pecah string QRIS menjadi daftar TLV tingkat atas. Melempar galat jika strukturnya rusak. */
export function bacaTLV(qris: string): TLV[] {
  const hasil: TLV[] = [];
  let i = 0;
  while (i < qris.length) {
    const tag = qris.slice(i, i + 2);
    const pjg = qris.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(pjg)) throw new Error("Struktur QRIS tidak valid");
    const n = Number(pjg);
    const nilai = qris.slice(i + 4, i + 4 + n);
    if (nilai.length !== n) throw new Error("Struktur QRIS tidak valid");
    hasil.push({ tag, nilai });
    i += 4 + n;
  }
  return hasil;
}

export function tulisTLV(daftar: TLV[]): string {
  return daftar.map(({ tag, nilai }) => `${tag}${String(nilai.length).padStart(2, "0")}${nilai}`).join("");
}

/** true jika tag 63 ada di akhir dan CRC-nya cocok. */
export function crcValid(qris: string): boolean {
  const m = qris.match(/6304([0-9A-F]{4})$/);
  return !!m && crc16(qris.slice(0, -4)) === m[1];
}

/** Nominal (tag 54) dalam QRIS, atau null jika tidak ada. */
export function bacaNominal(qris: string): number | null {
  const t = bacaTLV(qris).find((x) => x.tag === "54");
  return t ? Number(t.nilai) : null;
}

/**
 * Sisipkan nominal ke QRIS statis:
 * tag 01 "11" (statis) → "12" (dinamis), hapus tag 54 lama, sisipkan tag 54 (total tanpa desimal)
 * sebelum tag 58, hapus tag 63 lalu hitung ulang CRC atas seluruh string termasuk "6304".
 */
export function qrisDenganNominal(qris: string, total: number): string {
  if (!Number.isInteger(total) || total <= 0 || total > 9_999_999_999_999) throw new Error("Nominal tidak valid");
  const daftar = bacaTLV(qris.trim());
  if (daftar[0]?.tag !== "00") throw new Error("Bukan QRIS");

  const tanpa = daftar.filter((t) => t.tag !== "54" && t.tag !== "63");
  const t01 = tanpa.find((t) => t.tag === "01");
  if (t01) t01.nilai = "12";
  else tanpa.splice(1, 0, { tag: "01", nilai: "12" });

  const nominal: TLV = { tag: "54", nilai: String(total) };
  const i58 = tanpa.findIndex((t) => t.tag === "58");
  if (i58 >= 0) tanpa.splice(i58, 0, nominal);
  else tanpa.push(nominal);

  const isi = `${tulisTLV(tanpa)}6304`;
  return isi + crc16(isi);
}
