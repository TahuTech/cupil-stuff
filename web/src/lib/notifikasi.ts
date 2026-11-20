// Notifikasi singkat di bawah layar (toast). Gaya ada di layouts/Base.astro (.notifikasi).

let timer: ReturnType<typeof setTimeout> | undefined;

export function tampilkanNotifikasi(pesan: string, tautan?: { teks: string; href: string }, lama = 4000) {
  let el = document.getElementById("notifikasi");
  if (!el) {
    el = document.createElement("div");
    el.id = "notifikasi";
    el.className = "notifikasi";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.replaceChildren(document.createTextNode(pesan));
  if (tautan) {
    const a = document.createElement("a");
    a.href = tautan.href;
    a.textContent = tautan.teks;
    el.appendChild(a);
  }
  el.classList.add("tampil");
  clearTimeout(timer);
  timer = setTimeout(() => el!.classList.remove("tampil"), lama);
}
