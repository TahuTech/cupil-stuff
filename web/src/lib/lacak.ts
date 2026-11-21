// Halaman lacak resmi J&T Express Indonesia (menu Track & Trace).
// J&T tidak menerbitkan format URL yang menyertakan nomor resi, jadi nomor resi ditampilkan
// terpisah. Sama dengan pocketbase/pb_hooks/bersama.js (dijaga oleh bersama-hook.test.ts).
export const URL_LACAK_JNT = "https://jet.co.id/track";

export function linkLacakJNT() {
  return URL_LACAK_JNT;
}
