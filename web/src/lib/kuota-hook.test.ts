// Pembatasan POST /api/checkout dan /api/servis per IP (pocketbase/pb_hooks/kuota.js).
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

const K = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/kuota.js");
const JAM = 3_600_000;

let isi: Map<string, string>;
beforeEach(() => {
  isi = new Map();
  (globalThis as Record<string, unknown>).$app = {
    store: () => ({ get: (k: string) => isi.get(k), set: (k: string, v: string) => isi.set(k, v), remove: (k: string) => isi.delete(k) }),
  };
});
const dari = (ip: string) => ({
  requestInfo: () => ({ headers: { cf_connecting_ip: ip }, query: {} }),
  realIP: () => "172.23.0.5",
  request: { remoteAddr: "172.23.0.5:1", url: { rawQuery: "" } },
});

describe("status / tambah", () => {
  it("penuh setelah maks, lepas setelah jendela lewat", () => {
    let d = null;
    for (let i = 0; i < 10; i++) d = K.tambah(d, 1000 + i, JAM);
    expect(K.status(d, 2000, 10, JAM).penuh).toBe(true);
    expect(K.status(d, 1000 + JAM, 10, JAM).penuh).toBe(false);
    expect(K.tambah(d, 1000 + JAM, JAM)).toEqual({ n: 1, mulai: 1000 + JAM });
  });
});

describe("periksa + catatDibuat", () => {
  it("10 pesanan per jam per IP; ke-11 ditolak dengan pesan ramah; IP lain tidak terpengaruh", () => {
    const a = dari("198.51.100.1");
    for (let i = 0; i < 10; i++) {
      expect(K.periksa(a, "checkout")).toBeNull();
      K.catatDibuat(a, "checkout");
    }
    const tolak = K.periksa(a, "checkout");
    expect(tolak.status).toBe(429);
    expect(tolak.body.pesan).toMatch(/cukup banyak pesanan dalam satu jam terakhir\. Coba lagi sekitar \d+ menit lagi/);
    expect(K.periksa(dari("198.51.100.2"), "checkout")).toBeNull();
    expect(K.periksa(a, "servis")).toBeNull(); // kuota servis terpisah
  });
  it("30 percobaan per jam termasuk yang gagal validasi", () => {
    const a = dari("198.51.100.3");
    for (let i = 0; i < 30; i++) expect(K.periksa(a, "servis")).toBeNull();
    expect(K.periksa(a, "servis").body.pesan).toMatch(/Terlalu banyak percobaan/);
  });
  it("batas sesuai rencana", () => {
    expect(K.BATAS.checkout).toMatchObject({ dibuat: 10, percobaan: 30, durasi: JAM });
    expect(K.BATAS.servis).toMatchObject({ dibuat: 10, percobaan: 30, durasi: JAM });
  });
});
