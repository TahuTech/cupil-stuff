import { describe, expect, it } from "vitest";
import { bacaNominal, bacaTLV, crc16, crcValid, qrisDenganNominal, tulisTLV, type TLV } from "./qris";

// QRIS SINTETIS untuk test (merchant palsu), bukan QRIS toko.
function qrisSintetis(tambahan: TLV[] = []): string {
  const daftar: TLV[] = [
    { tag: "00", nilai: "01" },
    { tag: "01", nilai: "11" },
    { tag: "26", nilai: tulisTLV([{ tag: "00", nilai: "ID.CO.CONTOH.WWW" }, { tag: "01", nilai: "936000000000000001" }, { tag: "03", nilai: "UMI" }]) },
    { tag: "52", nilai: "5999" },
    { tag: "53", nilai: "360" },
    ...tambahan,
    { tag: "58", nilai: "ID" },
    { tag: "59", nilai: "TOKO CONTOH UJI" },
    { tag: "60", nilai: "SURABAYA" },
    { tag: "61", nilai: "60111" },
    { tag: "62", nilai: tulisTLV([{ tag: "07", nilai: "A01" }]) },
  ];
  const isi = `${tulisTLV(daftar)}6304`;
  return isi + crc16(isi);
}

describe("crc16 (CCITT, init 0xFFFF, poly 0x1021)", () => {
  it('"123456789" = 29B1', () => expect(crc16("123456789")).toBe("29B1"));
  it("4 digit hex kapital, termasuk nol di depan", () => {
    for (const s of ["", "A", "000201", "abc"]) expect(crc16(s)).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe("qrisDenganNominal", () => {
  const statis = qrisSintetis();

  it("QRIS sintetis awal valid dan statis", () => {
    expect(crcValid(statis)).toBe(true);
    expect(bacaTLV(statis).find((t) => t.tag === "01")?.nilai).toBe("11");
    expect(bacaNominal(statis)).toBeNull();
  });

  it("tag 01 jadi 12, nominal terbaca kembali, CRC valid", () => {
    const q = qrisDenganNominal(statis, 390_000);
    expect(crcValid(q)).toBe(true);
    expect(bacaTLV(q).find((t) => t.tag === "01")?.nilai).toBe("12");
    expect(bacaNominal(q)).toBe(390_000);
  });

  it("struktur TLV tetap valid: tag 54 tepat sebelum 58, tag 63 terakhir, tag lain tidak berubah", () => {
    const q = qrisDenganNominal(statis, 15_000);
    const tag = bacaTLV(q).map((t) => t.tag);
    expect(tag.indexOf("54")).toBe(tag.indexOf("58") - 1);
    expect(tag.at(-1)).toBe("63");
    expect(tag.filter((t) => t === "54")).toHaveLength(1);
    const tanpaUbah = (s: string) => bacaTLV(s).filter((t) => !["01", "54", "63"].includes(t.tag));
    expect(tanpaUbah(q)).toEqual(tanpaUbah(statis));
    expect(tulisTLV(bacaTLV(q))).toBe(q); // baca → tulis menghasilkan string yang sama
  });

  it("tag 54 lama diganti, bukan ditambah", () => {
    const sudahAda = qrisSintetis([{ tag: "54", nilai: "1000" }]);
    const q = qrisDenganNominal(sudahAda, 250_000);
    expect(bacaTLV(q).filter((t) => t.tag === "54")).toEqual([{ tag: "54", nilai: "250000" }]);
    expect(crcValid(q)).toBe(true);
  });

  it("nominal tanpa desimal; nominal tidak wajar ditolak", () => {
    expect(bacaTLV(qrisDenganNominal(statis, 1_234_567)).find((t) => t.tag === "54")?.nilai).toBe("1234567");
    for (const n of [0, -5, 1.5, NaN]) expect(() => qrisDenganNominal(statis, n)).toThrow();
  });

  it("menolak string yang bukan QRIS atau rusak", () => {
    expect(() => qrisDenganNominal("halo", 1000)).toThrow();
    expect(() => qrisDenganNominal(statis.slice(0, -10), 1000)).toThrow();
    expect(() => qrisDenganNominal("5802ID", 1000)).toThrow(); // tidak diawali tag 00
  });

  it("CRC salah terdeteksi", () => {
    const q = qrisDenganNominal(statis, 1000);
    const rusak = q.slice(0, -4) + (q.endsWith("0000") ? "1111" : "0000");
    expect(crcValid(rusak)).toBe(false);
  });
});
