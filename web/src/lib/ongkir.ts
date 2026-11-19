// Aturan ongkir Cupil Stuff (J&T EZ dari Surabaya). Sumber aturan: CLAUDE.md, bagian "Ongkir".

export const BATAS_OTOMATIS_KG = 5; // di atas ini: konfirmasi via WhatsApp
const TOLERANSI_GRAM = 300; // toleransi J&T: 1,3 kg tetap dihitung 1 kg
const POTONGAN_PER_KELIPATAN = 5000;
const KELIPATAN_BELANJA = 100000;

/** Berat yang ditagih (kg) dari total berat kirim (gram), minimal 1 kg. */
export function beratDitagihKg(totalGram: number): number {
  if (totalGram <= 1000 + TOLERANSI_GRAM) return 1;
  const kgPenuh = Math.floor(totalGram / 1000);
  const sisa = totalGram - kgPenuh * 1000;
  return sisa > TOLERANSI_GRAM ? kgPenuh + 1 : kgPenuh;
}

/** Potongan ongkir: Rp5.000 per kelipatan Rp100.000 belanja, paling banyak sebesar ongkir. */
export function potonganOngkir(subtotal: number, ongkir: number): number {
  const potongan = Math.floor(subtotal / KELIPATAN_BELANJA) * POTONGAN_PER_KELIPATAN;
  return Math.min(potongan, ongkir);
}

export type HasilOngkir =
  | { otomatis: true; beratKg: number; ongkir: number; potongan: number; dibayar: number }
  | { otomatis: false; beratKg: number; alasan: string };

export function hitungOngkir(totalGram: number, tarifPerKg: number, subtotal: number): HasilOngkir {
  const beratKg = beratDitagihKg(totalGram);
  if (totalGram > BATAS_OTOMATIS_KG * 1000) {
    return { otomatis: false, beratKg, alasan: `Berat di atas ${BATAS_OTOMATIS_KG} kg, ongkir dikonfirmasi via WhatsApp` };
  }
  const ongkir = beratKg * tarifPerKg;
  const potongan = potonganOngkir(subtotal, ongkir);
  return { otomatis: true, beratKg, ongkir, potongan, dibayar: ongkir - potongan };
}
