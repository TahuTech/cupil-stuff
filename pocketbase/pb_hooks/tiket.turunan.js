// Mengisi field turunan tiket servis dari data database (dipanggil tiket.hitung.pb.js).

function bacaJSON(rec, field) {
  try {
    const s = rec.getString(field);
    return s ? JSON.parse(s) : null;
  } catch (_) {
    return null;
  }
}

function dataTiket(r) {
  return {
    nomor: r.getString("nomor"),
    nama: r.getString("nama"),
    wa: r.getString("wa"),
    status: r.getString("status"),
    status_bayar: r.getString("status_bayar"),
    cara_kirim: r.getString("cara_kirim"),
    provinsi: r.getString("provinsi"),
    perangkat_jenis: r.getString("perangkat_jenis"),
    estimasi_biaya: r.getInt("estimasi_biaya"),
    biaya_final: r.getInt("biaya_final"),
    ongkir_kirim_balik: r.getInt("ongkir_kirim_balik"),
    resi: r.getString("resi"),
  };
}

function isiTurunan(app, r, baru) {
  const S = require(__hooks + "/servis.js");
  const t = dataTiket(r);

  let hitungOngkir = baru;
  if (!baru) {
    const asal = r.original();
    hitungOngkir = ["cara_kirim", "provinsi", "perangkat_jenis"].some(function (f) {
      return asal.getString(f) !== r.getString(f);
    });
  }
  if (hitungOngkir) {
    const zona = app.findAllRecords("zona_ongkir").map(function (z) {
      return { provinsi: bacaJSON(z, "provinsi") || [], tarif_per_kg: z.getInt("tarif_per_kg") };
    });
    const o = S.ongkirKirimBalik(t.cara_kirim, t.provinsi, t.perangkat_jenis, zona);
    t.ongkir_kirim_balik = o === null ? 0 : o; // 0 untuk kurir = belum bisa dihitung, isi manual
    r.set("ongkir_kirim_balik", t.ongkir_kirim_balik);
  }

  r.set("total_tagihan", S.totalTagihan(t));

  const situs = $os.getenv("SITE_URL") || "https://cupilstuff.id";
  const link = S.linkWA(t, { toko: "Cupil Stuff", situs: situs });
  for (const k in link) r.set(k, link[k]);
}

module.exports = { isiTurunan };
