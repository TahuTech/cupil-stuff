// Validasi env build produksi (web/src/lib/cek-env.ts).
// Skrip web/scripts/cek-env-build.mjs memakai aturan yang sama.
import { describe, expect, it } from "vitest";
import { galatEnvBuild, saranEnvBuild, pesanBuildGagal, WAJIB_PRODUKSI } from "./cek-env";

const lengkap = {
  PUBLIC_PB_URL: "https://api.cupilstuff.web.id",
  PUBLIC_SITE_URL: "https://cupilstuff.web.id",
  PUBLIC_CDN_URL: "https://cdn.cupilstuff.web.id",
  PUBLIC_QRIS_STATIS: "00020101021126...",
};

describe("galatEnvBuild", () => {
  it("env lengkap → tidak ada galat", () => {
    expect(galatEnvBuild(lengkap)).toEqual([]);
  });

  it("mode dev → selalu lolos (PocketBase lokal)", () => {
    expect(galatEnvBuild({}, true)).toEqual([]);
  });

  it("variabel wajib kosong → galat menyebut namanya", () => {
    const g = galatEnvBuild({});
    expect(g.length).toBe(WAJIB_PRODUKSI.length);
    for (const { nama } of WAJIB_PRODUKSI) expect(g.some((x) => x.includes(nama))).toBe(true);
  });

  it("nilai hanya spasi dianggap kosong", () => {
    expect(galatEnvBuild({ ...lengkap, PUBLIC_PB_URL: "   " }).some((x) => x.includes("PUBLIC_PB_URL"))).toBe(true);
  });

  it("wajib https:// dan bukan localhost", () => {
    expect(galatEnvBuild({ ...lengkap, PUBLIC_PB_URL: "http://api.cupilstuff.web.id" })[0]).toMatch(/https:\/\//);
    expect(galatEnvBuild({ ...lengkap, PUBLIC_SITE_URL: "/relatif" })[0]).toMatch(/https:\/\//);
    expect(galatEnvBuild({ ...lengkap, PUBLIC_PB_URL: "https://localhost:8090" })[0]).toMatch(/localhost/);
    expect(galatEnvBuild({ ...lengkap, PUBLIC_SITE_URL: "https://127.0.0.1" })[0]).toMatch(/localhost/);
  });

  it("http:// bukan https:// juga ditolak", () => {
    expect(galatEnvBuild({ ...lengkap, PUBLIC_PB_URL: "http://example.com" }).length).toBe(1);
  });
});

describe("saranEnvBuild", () => {
  it("kosong saat lengkap", () => {
    expect(saranEnvBuild(lengkap)).toEqual([]);
  });
  it("menyebut CDN dan QRIS bila kosong (tidak menggagalkan)", () => {
    const s = saranEnvBuild({ PUBLIC_PB_URL: "https://api.x.id", PUBLIC_SITE_URL: "https://x.id" });
    expect(s.some((x) => x.includes("PUBLIC_CDN_URL"))).toBe(true);
    expect(s.some((x) => x.includes("PUBLIC_QRIS_STATIS"))).toBe(true);
  });
  it("mode dev → tanpa saran", () => {
    expect(saranEnvBuild({}, true)).toEqual([]);
  });
});

describe("pesanBuildGagal", () => {
  it("memuat semua galat dan petunjuk lokasi variabel", () => {
    const p = pesanBuildGagal(["PUBLIC_PB_URL kosong", "PUBLIC_SITE_URL kosong"]);
    expect(p).toContain("PUBLIC_PB_URL kosong");
    expect(p).toContain("PUBLIC_SITE_URL kosong");
    expect(p).toContain("Cloudflare Pages");
  });
});