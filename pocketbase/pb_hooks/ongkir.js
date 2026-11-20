// Hitungan ongkir untuk hook PocketBase (dipanggil lewat require).
// HARUS menghasilkan angka yang sama dengan web/src/lib/ongkir.ts;
// dijaga oleh web/src/lib/ongkir-hook.test.ts. Aturan: CLAUDE.md, bagian "Ongkir".
// Ditulis tanpa sintaks baru (??, ?.) supaya aman di JSVM PocketBase.

const BATAS_OTOMATIS_KG = 5;
const TOLERANSI_GRAM = 300;
const POTONGAN_PER_KELIPATAN = 5000;
const KELIPATAN_BELANJA = 100000;

function beratDitagihKg(totalGram) {
  if (totalGram <= 1000 + TOLERANSI_GRAM) return 1;
  const kgPenuh = Math.floor(totalGram / 1000);
  const sisa = totalGram - kgPenuh * 1000;
  return sisa > TOLERANSI_GRAM ? kgPenuh + 1 : kgPenuh;
}

function potonganOngkir(subtotal, ongkir) {
  const potongan = Math.floor(subtotal / KELIPATAN_BELANJA) * POTONGAN_PER_KELIPATAN;
  return Math.min(potongan, ongkir);
}

function hitungOngkir(totalGram, tarifPerKg, subtotal) {
  const beratKg = beratDitagihKg(totalGram);
  if (totalGram > BATAS_OTOMATIS_KG * 1000) {
    return { otomatis: false, beratKg: beratKg, alasan: "Berat di atas " + BATAS_OTOMATIS_KG + " kg, ongkir dikonfirmasi via WhatsApp" };
  }
  const ongkir = beratKg * tarifPerKg;
  const potongan = potonganOngkir(subtotal, ongkir);
  return { otomatis: true, beratKg: beratKg, ongkir: ongkir, potongan: potongan, dibayar: ongkir - potongan };
}

function ringkasBayar(subtotal, totalGram, zona) {
  if (!zona) {
    return { otomatis: false, beratKg: beratDitagihKg(totalGram), alasan: "Zona pengiriman tidak ditemukan, ongkir dikonfirmasi via WhatsApp", total: subtotal };
  }
  const h = hitungOngkir(totalGram, zona.tarifPerKg, subtotal);
  if (!h.otomatis) return { otomatis: false, beratKg: h.beratKg, alasan: h.alasan, total: subtotal };
  return { otomatis: true, beratKg: h.beratKg, ongkir: h.ongkir, potongan: h.potongan, total: subtotal + h.dibayar };
}

module.exports = { BATAS_OTOMATIS_KG, beratDitagihKg, potonganOngkir, hitungOngkir, ringkasBayar };
