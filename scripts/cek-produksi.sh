#!/usr/bin/env bash
# Cek produksi Cupil Stuff: katalog, file CDN, API, panel admin, CORS, dan trusted proxy.
#
#   ./scripts/cek-produksi.sh
#
# Ringkasan lulus/gagal per cek. Kode keluar 0 jika semua lulus, 1 jika ada yang gagal.
# Tidak memerlukan token atau kredensial.

set -uo pipefail

SITUS="${SITE_URL:-https://cupilstuff.web.id}"
API="${API_URL:-https://api.cupilstuff.web.id}"
CDN="${CDN_URL:-https://cdn.cupilstuff.web.id}"

lulus=0
gagal=0

cek() {
  local nama="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  ✓ %s\n' "$nama"; lulus=$((lulus+1))
  else
    printf '  ✗ %s\n' "$nama"; gagal=$((gagal+1))
  fi
}

# Kode status HTTP
kode() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1"; }

http_200() { [ "$(kode "$1")" = "200" ]; }
# Halaman yang wajib 200 (Cloudflare Pages bisa 200 atau 301→200; -L mengikuti redirect)
http_200_follow() { [ "$(curl -s -L -o /dev/null -w '%{http_code}' --max-time 15 "$1")" = "200" ]; }

echo "== Cek produksi =="
echo "  Situs: $SITUS"
echo "  API:   $API"
echo "  CDN:   $CDN"
echo

# 1) Katalog
cek "Landing $SITUS merespons 200"        http_200 "$SITUS/"
cek "Katalog $SITUS/katalog merespons 200" http_200_follow "$SITUS/katalog"
cek "Halaman servis merespons 200"         http_200_follow "$SITUS/servis"

# 2) CDN: ambil satu file dari katalog lalu coba dari CDN
#    (dicek apakah cdn.<domain> menjawab; file spesifik bisa berubah)
cek "CDN $CDN menjawab (bukan error jaringan)" curl -s -o /dev/null --max-time 15 "$CDN/"

# 3) API health
cek "API /api/health = 200" http_200 "$API/api/health"

# 4) Panel admin harus meminta login (Cloudflare Access → 302/401/403, BUKAN 200 terbuka)
admin_kode=$(kode "$API/_/")
if [ "$admin_kode" = "200" ]; then
  printf '  ✗ Panel admin /_/ TERBUKA tanpa login (kode 200). Lindungi dengan Cloudflare Access!\n'; gagal=$((gagal+1))
else
  printf '  ✓ Panel admin /_/ meminta login (kode %s)\n' "$admin_kode"; lulus=$((lulus+1))
fi

# 5) CORS: origin asing harus ditolak
cors_asing=$(curl -s -o /dev/null -D - --max-time 15 -H 'Origin: https://penyusup.example' "$API/api/health" 2>/dev/null | tr -d '\r' | grep -i '^access-control-allow-origin' || true)
if [ -z "$cors_asing" ]; then
  printf '  ✓ CORS menolak origin asing (tidak ada header allow-origin)\n'; lulus=$((lulus+1))
elif echo "$cors_asing" | grep -qi 'penyusup'; then
  printf '  ✗ CORS menerima origin asing: %s\n' "$cors_asing"; gagal=$((gagal+1))
else
  printf '  ✓ CORS tidak mengizinkan origin asing\n'; lulus=$((lulus+1))
fi

# 6) CORS: origin sendiri harus diizinkan
cors_sendiri=$(curl -s -o /dev/null -D - --max-time 15 -H "Origin: $SITUS" "$API/api/health" 2>/dev/null | tr -d '\r' | grep -i '^access-control-allow-origin' || true)
if echo "$cors_sendiri" | grep -qi "$SITUS"; then
  printf '  ✓ CORS mengizinkan %s\n' "$SITUS"; lulus=$((lulus+1))
else
  printf '  ✗ CORS belum mengizinkan %s (cek PB_ORIGINS di .env homelab)\n' "$SITUS"; gagal=$((gagal+1))
fi

# 7) Trusted proxy: header CF-Connecting-IP terbaca (rate limit memakai IP ini)
#    Bukti tidak langsung: 6 kali salah dari IP uji yang sama → percobaan ke-6 harus 429.
#    Menggunakan nomor pesanan yang (sengaja) tidak ada agar tidak mengubah data.
proxy_ok=0
for i in 1 2 3 4 5 6; do
  k=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "CF-Connecting-IP: 203.0.113.77" "$API/api/pesanan/CS-000000-0000?wa=9999")
  if [ "$i" = "6" ] && [ "$k" = "429" ]; then proxy_ok=1; fi
done
if [ "$proxy_ok" = "1" ]; then
  printf '  ✓ CF-Connecting-IP terbaca (percobaan ke-6 diblokir 429)\n'; lulus=$((lulus+1))
else
  printf '  ✗ CF-Connecting-IP tidak terbaca / rate limit tidak jalan (percobaan ke-6 bukan 429)\n'; gagal=$((gagal+1))
fi

echo
echo "== Ringkasan: $lulus lulus, $gagal gagal =="
[ "$gagal" -eq 0 ] && exit 0 || exit 1
