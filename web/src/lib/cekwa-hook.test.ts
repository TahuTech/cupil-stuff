// Pembatasan percobaan 4 digit WA (pocketbase/pb_hooks/cekwa.js).
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

const W = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/cekwa.js");

// $app.store() tiruan (di PocketBase: penyimpanan di memori server)
let isi: Map<string, string>;
beforeEach(() => {
  isi = new Map();
  (globalThis as Record<string, unknown>).$app = {
    store: () => ({ get: (k: string) => isi.get(k), set: (k: string, v: string) => isi.set(k, v), remove: (k: string) => isi.delete(k) }),
  };
});
const permintaan = (headers: Record<string, string>, remote = "172.23.0.5:41000") => ({
  requestInfo: () => ({ headers, query: {} }),
  realIP: () => remote.split(":")[0],
  request: { remoteAddr: remote, url: { rawQuery: "" } },
});
const tiket = (wa: string) => ({ getString: () => wa });

describe("ipKlien", () => {
  it("memakai CF-Connecting-IP (kunci PocketBase: cf_connecting_ip)", () => {
    expect(W.ipKlien(permintaan({ cf_connecting_ip: "203.0.113.7" }))).toBe("203.0.113.7");
  });
  it("X-Forwarded-For diabaikan (bisa dipalsukan); jatuh ke IP koneksi", () => {
    expect(W.ipKlien(permintaan({ x_forwarded_for: "10.9.9.9" }))).toBe("172.23.0.5");
  });
});

describe("statusBlokir / catatGagal", () => {
  const J = W.DURASI_BLOKIR_MS;
  it("diblokir setelah 5 gagal dalam satu jendela, lepas setelah jendela lewat", () => {
    let d = null;
    for (let i = 0; i < 4; i++) d = W.catatGagal(d, 1000 + i);
    expect(W.statusBlokir(d, 2000).diblokir).toBe(false);
    d = W.catatGagal(d, 2000);
    expect(W.statusBlokir(d, 2000)).toMatchObject({ diblokir: true });
    expect(W.statusBlokir(d, 1000 + J).diblokir).toBe(false);
  });
  it("gagal setelah jendela lewat memulai hitungan baru", () => {
    const d = W.catatGagal({ gagal: 4, mulai: 0 }, J + 1);
    expect(d).toEqual({ gagal: 1, mulai: J + 1 });
  });
});

describe("cekWA", () => {
  const e = permintaan({ cf_connecting_ip: "198.51.100.1" });
  it("4 digit benar lolos, salah ditolak 403, format salah 400", () => {
    expect(W.cekWA(e, tiket("6281234567890"), "7890", "tiket")).toBeNull();
    expect(W.cekWA(e, tiket("6281234567890"), "0000", "tiket").status).toBe(403);
    expect(W.cekWA(e, tiket("6281234567890"), "12a4", "tiket").status).toBe(400);
  });
  it("5 kali salah → 429, termasuk untuk 4 digit yang benar", () => {
    for (let i = 0; i < 5; i++) W.cekWA(e, tiket("6281234567890"), "0000", "tiket");
    expect(W.cekWA(e, tiket("6281234567890"), "7890", "tiket").status).toBe(429);
  });
  it("berhasil pada tiket sendiri TIDAK mereset hitungan", () => {
    for (let i = 0; i < 4; i++) W.cekWA(e, tiket("6281234567890"), "0000", "tiket");
    expect(W.cekWA(e, tiket("6289999990000"), "0000", "tiket")).toBeNull(); // tiket milik sendiri
    expect(W.cekWA(e, tiket("6281234567890"), "1111", "tiket").status).toBe(403); // ke-5
    expect(W.cekWA(e, tiket("6281234567890"), "2222", "tiket").status).toBe(429);
  });
  it("IP lain tidak ikut terblokir", () => {
    for (let i = 0; i < 5; i++) W.cekWA(e, tiket("6281234567890"), "0000", "tiket");
    expect(W.cekWA(permintaan({ cf_connecting_ip: "198.51.100.2" }), tiket("6281234567890"), "7890", "tiket")).toBeNull();
  });
});
