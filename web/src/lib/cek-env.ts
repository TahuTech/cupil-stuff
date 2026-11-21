// Validasi variabel env untuk build produksi katalog.
// Dipakai scripts/cek-env-build.mjs (dijalankan sebelum `npm run build` di Cloudflare Pages)
// dan punya unit test (cek-env.test.ts). Fungsi murni: tidak membaca import.meta.env.

export type EnvBuild = Record<string, string | undefined>;

/** Variabel yang WAJIB ada saat build produksi, beserta pesan bila kosong. */
export const WAJIB_PRODUKSI: { nama: string; pesan: string }[] = [
  { nama: "PUBLIC_PB_URL", pesan: "Alamat API PocketBase, mis. https://api.cupilstuff.web.id" },
  { nama: "PUBLIC_SITE_URL", pesan: "Alamat katalog, mis. https://cupilstuff.web.id" },
];

/** Variabel opsional yang berguna, diberi peringatan (bukan galat) bila kosong. */
export const SARAN_PRODUKSI: { nama: string; pesan: string }[] = [
  { nama: "PUBLIC_CDN_URL", pesan: "Tanpa ini, foto dan 3D dimuat lewat PocketBase (lebih lambat, bergantung ke homelab)" },
  { nama: "PUBLIC_QRIS_STATIS", pesan: "Tanpa ini, halaman pesanan tidak menampilkan QRIS" },
];

const polos = (v: string | undefined) => String(v ?? "").trim();

/** Galat yang harus menggagalkan build. Kosong = lolos. */
export function galatEnvBuild(env: EnvBuild, dev = false): string[] {
  if (dev) return []; // development: PocketBase lokal, tidak perlu variabel produksi
  const galat: string[] = [];
  for (const { nama, pesan } of WAJIB_PRODUKSI) {
    if (!polos(env[nama])) galat.push(`${nama} kosong — ${pesan}`);
  }
  // Harus URL absolut https (bukan localhost) di produksi
  for (const nama of ["PUBLIC_PB_URL", "PUBLIC_SITE_URL"]) {
    const v = polos(env[nama]);
    if (!v) continue;
    if (!/^https:\/\/[^/\s]+/.test(v)) galat.push(`${nama} harus diawali https:// (bukan http atau relatif): "${v}"`);
    else if (/^https:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(v)) galat.push(`${nama} masih menunjuk localhost: "${v}"`);
  }
  return galat;
}

/** Saran (tidak menggagalkan build). */
export function saranEnvBuild(env: EnvBuild, dev = false): string[] {
  if (dev) return [];
  return SARAN_PRODUKSI.filter(({ nama }) => !polos(env[nama])).map(({ nama, pesan }) => `${nama} kosong — ${pesan}`);
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
    "",
  ].join("\n");
}