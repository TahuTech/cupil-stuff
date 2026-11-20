// Perilaku maskot (badan penuh dan kepala), dipakai bersama oleh Maskot.astro dan MaskotKepala.astro.
// Modul ini dibundel sekali per halaman, jadi semua maskot berbagi:
// - satu set listener pointer di dokumen (pasif), hanya aktif jika ada maskot terlihat dan tab aktif
// - satu IntersectionObserver
// - satu listener EVENT_SENANG (lihat maskot.ts)
// Bagian SVG diubah lewat atribut/kelas dari JS; CSS-nya global (bukan ber-scope).

import { EVENT_SENANG } from "./maskot";

export type JenisMaskot = {
  /** viewBox SVG: x, y, lebar */
  viewBox: { x: number; y: number; lebar: number };
  /** titik tengah mata dalam koordinat viewBox */
  tengahMata: { x: number; y: number };
  /** makin kecil, makin cepat pupil mencapai geseran maksimal */
  pembagiJarak: number;
  /** animasi saat diketuk: "hop" (lompat, badan penuh) atau "pop" (membesar, kepala di header) */
  gerakSenang: "hop" | "pop";
};

export const BADAN_PENUH: JenisMaskot = {
  viewBox: { x: 0, y: 0, lebar: 220 },
  tengahMata: { x: 110, y: 112 },
  pembagiJarak: 35,
  gerakSenang: "hop",
};

export const KEPALA: JenisMaskot = {
  viewBox: { x: 30, y: 16, lebar: 160 },
  tengahMata: { x: 110, y: 112 },
  pembagiJarak: 20,
  gerakSenang: "pop",
};

const GESER_MAKS = 4; // unit viewBox
const LAMA_SENANG = 1200;

type Maskot = {
  svg: SVGSVGElement;
  jenis: JenisMaskot;
  titik: { el: Element; x: number; y: number }[];
  terlihat: boolean;
  timerKedip?: ReturnType<typeof setTimeout>;
  timerSenang?: ReturnType<typeof setTimeout>;
};

const semua: Maskot[] = [];
const gerakBoleh = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
const tabAktif = () => document.visibilityState === "visible";
let posisiTerakhir: { x: number; y: number } | null = null;

// ---------- pupil dan kilau mengikuti kursor / sentuhan terakhir ----------
function lihat(m: Maskot, cx: number, cy: number) {
  const { viewBox: vb, tengahMata, pembagiJarak } = m.jenis;
  const r = m.svg.getBoundingClientRect();
  if (!r.width) return;
  const s = r.width / vb.lebar;
  const dx = cx - (r.left + (tengahMata.x - vb.x) * s);
  const dy = cy - (r.top + (tengahMata.y - vb.y) * s);
  const d = Math.hypot(dx, dy) || 1;
  const geser = Math.min(GESER_MAKS, d / pembagiJarak);
  for (const t of m.titik) {
    t.el.setAttribute("cx", String(t.x + (dx / d) * geser));
    t.el.setAttribute("cy", String(t.y + (dy / d) * geser));
  }
}

function lacak(e: PointerEvent) {
  posisiTerakhir = { x: e.clientX, y: e.clientY };
  for (const m of semua) if (m.terlihat) lihat(m, e.clientX, e.clientY);
}

let pelacakAktif = false;
function aturPelacak() {
  const perlu = gerakBoleh() && tabAktif() && semua.some((m) => m.terlihat);
  if (perlu === pelacakAktif) return;
  pelacakAktif = perlu;
  for (const jenis of ["pointermove", "pointerdown"] as const) {
    if (perlu) document.addEventListener(jenis, lacak, { passive: true });
    else document.removeEventListener(jenis, lacak);
  }
}

// ---------- kedip acak 2,5–5,5 detik, hanya saat terlihat dan tab aktif ----------
function jadwalKedip(m: Maskot) {
  clearTimeout(m.timerKedip);
  if (!m.terlihat || !tabAktif()) return;
  m.timerKedip = setTimeout(() => {
    if (!m.svg.classList.contains("senang")) {
      m.svg.classList.add("blink");
      setTimeout(() => m.svg.classList.remove("blink"), 150);
    }
    jadwalKedip(m);
  }, 2500 + Math.random() * 3000);
}

// ---------- ekspresi senang 1,2 detik + hop/pop ----------
export function senang(m: Maskot) {
  clearTimeout(m.timerSenang);
  m.svg.classList.add("senang");
  if (gerakBoleh()) {
    const kelas = m.jenis.gerakSenang;
    m.svg.classList.remove(kelas);
    void m.svg.getBoundingClientRect(); // restart animasi jika diketuk beruntun
    m.svg.classList.add(kelas);
    setTimeout(() => m.svg.classList.remove(kelas), 200);
  }
  m.timerSenang = setTimeout(() => m.svg.classList.remove("senang"), LAMA_SENANG);
}

// ---------- pengamat bersama ----------
let pengamat: IntersectionObserver | null = null;
function siapkanBersama() {
  if (pengamat) return;
  pengamat = new IntersectionObserver((entri) => {
    for (const e of entri) {
      const m = semua.find((x) => x.svg === e.target);
      if (!m) continue;
      m.terlihat = e.isIntersecting;
      if (m.terlihat && posisiTerakhir && gerakBoleh()) lihat(m, posisiTerakhir.x, posisiTerakhir.y);
      jadwalKedip(m);
    }
    aturPelacak();
  });
  document.addEventListener("visibilitychange", () => {
    for (const m of semua) jadwalKedip(m);
    aturPelacak();
  });
  window.addEventListener(EVENT_SENANG, () => {
    for (const m of semua) if (m.terlihat) senang(m);
  });
}

/** Pasang perilaku pada satu SVG maskot. Mengembalikan objek maskot (untuk senang()). */
export function pasangMaskot(svg: SVGSVGElement, jenis: JenisMaskot, opsi: { senangAwal?: boolean } = {}) {
  siapkanBersama();
  const titik = [...svg.querySelectorAll(".bola, .kilau")].map((el) => ({
    el,
    x: Number(el.getAttribute("cx")),
    y: Number(el.getAttribute("cy")),
  }));
  const m: Maskot = { svg, jenis, titik, terlihat: false };
  semua.push(m);
  pengamat!.observe(svg);
  if (opsi.senangAwal) senang(m);
  return m;
}
