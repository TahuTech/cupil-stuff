// Validasi variabel env untuk build produksi katalog.
// Dipakai scripts/cek-env-build.mjs (dijalankan sebelum `npm run build` di Cloudflare Pages)
// dan punya unit test (cek-env.test.ts, termasuk memastikan skrip .mjs setuju dengan logika ini).
// Fungsi murni: tidak membaca import.meta.env. Nilai variabel TIDAK pernah dicetak, hanya namanya.

export type EnvBuild = Record<string, string | undefined>;

/** Variabel yang WAJIB ada saat build produksi, beserta pesan bila kosong. */
export const WAJIB_PRODUKSI: { nama: string; pesan: string; url: boolean }[] = [
  { nama: "PUBLIC_PB_URL", pesan: "Alamat API PocketBase, mis. https://api.cupilstuff.web.id", url: true },
  { nama: "PUBLIC_SITE_URL", pesan: "Alamat katalog, mis. https://cupilstuff.web.id", url: true },
  { nama: "PUBLIC_CDN_URL", pesan: "Alamat publik bucket R2, mis. https://cdn.cupilstuff.web.id (tanpa ini foto dan 3D bergantung ke homelab)", url: true },
  { nama: "PUBLIC_QRIS_STATIS", pesan: "Teks QRIS statis toko (tanpa ini pembeli tidak bisa membayar)", url: false },
];

const polos = (v: string | undefined) => String(v ?? "").trim();

/** Galat yang harus menggagalkan build. Kosong = lolos. */
export function galatEnvBuild(env: EnvBuild, dev = false): string[] {
  if (dev) return []; // development: PocketBase lokal, tidak perlu variabel produksi
  const galat: string[] = [];
  for (const { nama, pesan, url } of WAJIB_PRODUKSI) {
    const v = polos(env[nama]);
    if (!v) {
      galat.push(`${nama} kosong — ${pesan}`);
      continue;
    }
    if (!url) continue;
    // Harus URL absolut https (bukan localhost) di produksi. Nilainya sengaja tidak dicetak ulang.
    if (!/^https:\/\/[^/\s]+/.test(v)) galat.push(`${nama} harus diawali https:// (bukan http atau relatif)`);
    else if (/^https:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(v)) galat.push(`${nama} masih menunjuk localhost`);
  }
  return galat;
}

/** Pesan ringkas untuk ditampilkan di terminal saat build gagal. */
export function pesanBuildGagal(galat: string[]): string {
  return [
    "",
    "✗ Build produksi dibatalkan: variabel environment belum lengkap.",
    "",
    ...galat.map((g) => `  • ${g}`),
    "",
    "Isi variabel di Cloudflare Pages → Settings → Environment variables",
    "(lihat web/.env.example), lalu deploy ulang.",
    "Build lokal tanpa variabel produksi: BUILD_DEV=1 npm run build",
    "",
  ].join("\n");
}
