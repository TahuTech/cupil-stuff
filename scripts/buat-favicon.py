#!/usr/bin/env python3
"""Buat favicon dari assets/maskot/maskot-kepala.svg.

    python3 scripts/buat-favicon.py

Hasil:
  web/public/favicon.svg           kepala tanpa kelas animasi, kelopak, dan ekspresi senang
  web/public/apple-touch-icon.png  180x180, latar terang (butuh rsvg-convert dari librsvg)
"""
import re
import subprocess
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
SUMBER = AKAR / "assets/maskot/maskot-kepala.svg"
PUBLIK = AKAR / "web/public"

svg = SUMBER.read_text(encoding="utf-8")
svg = re.sub(r"<!--.*?-->\s*", "", svg, flags=re.S)
# bagian yang hanya tampil lewat animasi: kelopak (kedip), mata senang, mulut senang
svg = re.sub(r'\s*<(rect|path)[^>]*class="lid"[^>]*/>', "", svg)
svg = re.sub(r'\s*<g class="(happy|mulut-senang)".*?</g>', "", svg, flags=re.S)
svg = re.sub(r'\s(class|aria-hidden)="[^"]*"', "", svg)
svg = re.sub(r"\n\s*\n", "\n", svg)
assert "lid" not in svg and "class=" not in svg
(PUBLIK / "favicon.svg").write_text(svg, encoding="utf-8")

# apple-touch-icon: iOS tidak mendukung transparansi dan membulatkan sudut sendiri,
# jadi kepala ditaruh di latar penuh dengan sedikit ruang di tepi.
isi = re.sub(r"^<svg[^>]*>|</svg>\s*$", "", svg.strip())
ikon = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#F6F5F2"/>
  <svg x="14" y="14" width="152" height="152" viewBox="30 16 160 160">{isi}</svg>
</svg>"""
subprocess.run(
    ["rsvg-convert", "-w", "180", "-h", "180", "-o", str(PUBLIK / "apple-touch-icon.png")],
    input=ikon.encode(), check=True,
)
print("favicon.svg dan apple-touch-icon.png dibuat di", PUBLIK)
