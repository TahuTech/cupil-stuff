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
  const U = require(__hooks + "/ulasan.wa.js");
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

  const link = S.linkWA(t, { toko: "Cupil Stuff", situs: require(__hooks + "/bersama.js").situsDariEnv() });
  for (const k in link) r.set(k, link[k]);

  // token ulasan: dibuat saat tiket layak (status dikirim); kedaluwarsa 30 hari → dimatikan.
  let token = r.getString("token_ulasan");
  if (U.layak("tiket", t.status)) {
    const hasil = U.tokenUntuk(token, r.getString("created"), Date.now(), Math.random);
    if (hasil.token) token = hasil.token;
    else if (hasil.kedaluwarsa) token = "";
    if (token !== r.getString("token_ulasan")) r.set("token_ulasan", token);
  }

  const lu = U.linkUlasanWA({
    wa: r.getString("wa"),
    jenis: "tiket",
    nama: r.getString("nama"),
    nomor: r.getString("nomor"),
    token: token,
  }, { toko: "Cupil Stuff", situs: require(__hooks + "/bersama.js").situsDariEnv() });
  r.set("link_wa_ulasan", lu.link_wa_ulasan);
}

module.exports = { isiTurunan };