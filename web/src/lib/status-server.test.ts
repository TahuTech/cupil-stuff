// Deteksi status server dan perilaku fetchServer/waktu (web/src/lib/status-server.ts).
// `fetch` di-stub supaya tidak menyentuh jaringan sungguhan.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// urlApi memakai import.meta.env; sinyal ke modul cukup lewat stub fetch.
vi.mock("./api", () => ({ urlApi: (j: string) => j }));

type Mod = typeof import("./status-server");

async function muatModul(): Promise<Mod> {
  vi.resetModules();
  return await import("./status-server");
}

describe("status-server", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("gagalKarenaServer: null (jaringan/timeout) dan 5xx dianggap mati; 4xx/429 bukan", async () => {
    {
      const m = await muatModul();
      expect(m.gagalKarenaServer(null)).toBe(true); // tidak ada respons
      expect(m.gagalKarenaServer(500)).toBe(true);
      expect(m.gagalKarenaServer(502)).toBe(true);
      expect(m.gagalKarenaServer(503)).toBe(true);
      expect(m.gagalKarenaServer(400)).toBe(false); // validasi
      expect(m.gagalKarenaServer(403)).toBe(false); // 4 digit salah
      expect(m.gagalKarenaServer(404)).toBe(false);
      expect(m.gagalKarenaServer(409)).toBe(false); // stok habis
      expect(m.gagalKarenaServer(429)).toBe(false); // rate limit
      expect(m.gagalKarenaServer(200)).toBe(false);
    }
  });

  it("cekServer: 200 → hidup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const m = await muatModul();
    expect(await m.cekServer()).toBe("hidup");
  });

  it("cekServer: error jaringan → mati", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const m = await muatModul();
    expect(await m.cekServer()).toBe("mati");
  });

  it("cekServer: timeout (abort) → mati", async () => {
    // fetch yang tidak pernah selesai sampai di-abort
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: RequestInit) => new Promise((_res, rej) => {
      init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
    })));
    const m = await muatModul();
    const p = m.cekServer();
    await vi.advanceTimersByTimeAsync(3000); // lewati timeout 3 detik
    expect(await p).toBe("mati");
  });

  it("cekServer: 5xx → mati, 4xx → hidup (server menjawab)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    let m = await muatModul();
    expect(await m.cekServer()).toBe("mati");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    m = await muatModul();
    expect(await m.cekServer()).toBe("hidup");
  });

  it("cekServer: hasil disimpan 60 detik (tidak mengecek berulang)", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    const m = await muatModul();
    await m.cekServer();
    await m.cekServer();
    await m.cekServer();
    expect(f).toHaveBeenCalledTimes(1);
    // lewati 60 detik → cek lagi
    await vi.advanceTimersByTimeAsync(60_000);
    await m.cekServer();
    expect(f).toHaveBeenCalledTimes(2);
    // paksa → tetap mengecek walau cache masih berlaku
    await m.cekServer(true);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("fetchServer: gagal jaringan menandai server mati (cek berikutnya tidak menembak health)", async () => {
    const health = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/health") return health();
      throw new TypeError("Failed to fetch");
    }));
    const m = await muatModul();
    await expect(m.fetchServer("/api/checkout", { method: "POST" })).rejects.toThrow();
    // setelah gagal, cekServer membaca cache "mati" tanpa memanggil health
    expect(await m.cekServer()).toBe("mati");
    expect(health).not.toHaveBeenCalled();
  });

  it("fetchServer: 5xx menandai mati, 400/409/429 tetap hidup", async () => {
    for (const [kode, harap] of [[500, "mati"], [400, "hidup"], [409, "hidup"], [429, "hidup"]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: kode as number })));
      const m = await muatModul();
      await m.fetchServer("/api/checkout");
      expect(await m.cekServer(), String(kode)).toBe(harap);
    }
  });

  it("deteksiAwal: mengatur banner #banner-server sesuai status", async () => {
    // Stub minimal DOM (lingkungan test default = node, tanpa jsdom)
    const banner = { hidden: false } as { hidden: boolean };
    vi.stubGlobal("document", { getElementById: (id: string) => (id === "banner-server" ? banner : null) });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    let m = await muatModul();
    await m.deteksiAwal();
    expect(banner.hidden).toBe(true); // server hidup → banner disembunyikan

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("x"); }));
    m = await muatModul();
    await m.deteksiAwal();
    expect(banner.hidden).toBe(false); // server mati → banner tampil
  });

  it("pantauServer: saat mati dicek ulang tiap 15 detik tanpa cache, lalu kembali normal tanpa reload", async () => {
    const banner = { hidden: true };
    const tangkap: Record<string, () => void> = {};
    vi.stubGlobal("document", {
      hidden: false,
      getElementById: (id: string) => (id === "banner-server" ? banner : null),
      addEventListener: (n: string, f: () => void) => { tangkap[n] = f; },
    });
    let hidup = false;
    const fetchTiruan = vi.fn(async () => {
      if (!hidup) throw new TypeError("mati");
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchTiruan);
    const m = await muatModul();
    const riwayat: boolean[] = [];
    m.pantauServer((mati) => riwayat.push(mati));
    await vi.advanceTimersByTimeAsync(10);
    expect(riwayat).toEqual([true]); // awal: mati

    await vi.advanceTimersByTimeAsync(m.JEDA_PANTAU_MS);
    expect(riwayat).toEqual([true, true]); // masih mati: dicek lagi (bukan dari cache)
    expect(fetchTiruan).toHaveBeenCalledTimes(2);

    hidup = true; // server hidup lagi
    await vi.advanceTimersByTimeAsync(m.JEDA_PANTAU_MS);
    expect(riwayat[riwayat.length - 1]).toBe(false);

    const n = fetchTiruan.mock.calls.length;
    await vi.advanceTimersByTimeAsync(m.JEDA_PANTAU_MS * 3);
    expect(fetchTiruan.mock.calls.length).toBe(n); // sudah hidup: tidak menembak terus-menerus
  });
});
