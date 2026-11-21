// Fungsi yang ada di hook (pocketbase/pb_hooks/bersama.js) dan di web harus sama.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { rupiah } from "./format";
import { URL_LACAK_JNT, linkLacakJNT } from "./lacak";

const B = createRequire(import.meta.url)("../../../pocketbase/pb_hooks/bersama.js");

describe("bersama.js = web", () => {
  it.each([0, 5_000, 150_000, 1_234_567, 99_999_999])("rupiah(%i) sama", (n) => expect(B.rp(n)).toBe(rupiah(n)));
  it("satu halaman lacak J&T untuk tahap 4 dan 5", () => {
    expect(B.URL_LACAK_JNT).toBe(URL_LACAK_JNT);
    expect(B.linkLacakJNT()).toBe(linkLacakJNT());
    expect(B.teksLacak("JX123")).toContain("JX123");
    expect(B.teksLacak("JX123")).toContain(URL_LACAK_JNT);
  });
  it("tautan situs hanya dari SITE_URL", () => {
    expect(B.tautanSitus("https://toko.contoh/", "/bayar")).toBe("https://toko.contoh/bayar");
    expect(B.tautanSitus("", "/bayar")).toBe("");
  });
});
