// Validasi env build produksi (web/src/lib/cek-env.ts).
// Skrip web/scripts/cek-env-build.mjs memakai aturan yang sama.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { galatEnvBuild, pesanBuildGagal, WAJIB_PRODUKSI } from "./cek-env";

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

describe("pesanBuildGagal", () => {
  it("memuat semua galat dan petunjuk lokasi variabel", () => {
    const p = pesanBuildGagal(["PUBLIC_PB_URL kosong", "PUBLIC_SITE_URL kosong"]);
    expect(p).toContain("PUBLIC_PB_URL kosong");
    expect(p).toContain("PUBLIC_SITE_URL kosong");
    expect(p).toContain("Cloudflare Pages");
  });
});

describe("variabel wajib produksi", () => {
  it("CDN dan QRIS ikut wajib; pesan galat tidak mencetak nilainya", () => {
    const g = galatEnvBuild({ ...lengkap, PUBLIC_CDN_URL: "", PUBLIC_QRIS_STATIS: "" });
    expect(g.some((x) => x.includes("PUBLIC_CDN_URL"))).toBe(true);
    expect(g.some((x) => x.includes("PUBLIC_QRIS_STATIS"))).toBe(true);
    const rahasia = "RAHASIA-JANGAN-DICETAK";
    expect(galatEnvBuild({ ...lengkap, PUBLIC_PB_URL: "http://" + rahasia }).join("\n")).not.toContain(rahasia);
  });
});

// Skrip prebuild (.mjs) harus sependapat dengan fungsi di atas.
describe("scripts/cek-env-build.mjs", () => {
  const skrip = fileURLToPath(new URL("../../scripts/cek-env-build.mjs", import.meta.url));
  const jalankan = (env: Record<string, string>) => {
    try {
      const out = execFileSync("node", [skrip], { env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return { kode: 0, out };
    } catch (e) {
      const x = e as { status: number; stderr: string };
      return { kode: x.status, out: x.stderr };
    }
  };
  const kosong = { PUBLIC_PB_URL: "", PUBLIC_SITE_URL: "", PUBLIC_CDN_URL: "", PUBLIC_QRIS_STATIS: "" };

  it("lengkap → lolos", () => {
    expect(jalankan({ ...kosong, ...lengkap }).kode).toBe(0);
  });
  it("tiap variabel wajib kosong → gagal dengan nama variabelnya", () => {
    for (const { nama } of WAJIB_PRODUKSI) {
      const r = jalankan({ ...kosong, ...lengkap, [nama]: "" });
      expect(r.kode, nama).toBe(1);
      expect(r.out).toContain(nama);
    }
  });
  it("http:// atau localhost → gagal; BUILD_DEV=1 → lolos", () => {
    expect(jalankan({ ...kosong, ...lengkap, PUBLIC_PB_URL: "http://api.cupilstuff.web.id" }).kode).toBe(1);
    expect(jalankan({ ...kosong, ...lengkap, PUBLIC_CDN_URL: "https://localhost:9000" }).kode).toBe(1);
    expect(jalankan({ ...kosong, BUILD_DEV: "1" }).kode).toBe(0);
  });
});
