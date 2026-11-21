#!/usr/bin/env bash
# Cek produksi Cupil Stuff: katalog, satu file di CDN, API, panel admin (Cloudflare Access),
# CORS, dan pembacaan IP asli (CF-Connecting-IP).
#
#   ./scripts/cek-produksi.sh
#
# Alamat bisa diganti lewat env SITE_URL, API_URL, CDN_URL (berguna untuk uji lokal).
# Ringkasan lulus/gagal per cek. Kode keluar 0 bila tidak ada yang gagal, 1 bila ada.
# Cek yang tidak bisa dijalankan karena datanya belum ada (mis. katalog masih kosong) ditandai
# "dilewati" dan tidak dihitung lulus maupun gagal.
# Tidak memerlukan token atau kredensial dan tidak mengubah data.

set -uo pipefail

SITUS="${SITE_URL:-https://cupilstuff.web.id}"; SITUS="${SITUS%/}"
API="${API_URL:-https://api.cupilstuff.web.id}"; API="${API%/}"
CDN="${CDN_URL:-https://cdn.cupilstuff.web.id}"; CDN="${CDN%/}"
ORIGIN_ASING="https://penyusup.invalid"

lulus=0; gagal=0; lewat=0
ok()    { printf '  ✓ %s\n' "$1"; lulus=$((lulus+1)); }
buruk() { printf '  ✗ %s\n' "$1"; gagal=$((gagal+1)); }
lewati(){ printf '  - %s (dilewati)\n' "$1"; lewat=$((lewat+1)); }

kode()        { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }
kode_ikut()   { curl -s -L -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }
# Header allow-origin dari preflight POST (seperti yang dikirim browser saat checkout)
allow_origin() { curl -s -o /dev/null -D - --max-time 15 -X OPTIONS \
  -H "Origin: $1" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' \
  "$API/api/checkout" 2>/dev/null | tr -d '\r' | grep -i '^access-control-allow-origin:' | head -1 | cut -d: -f2- | tr -d ' '; }

lokal=0
case "$API" in http://127.*|http://localhost*|http://\[::1\]*) lokal=1 ;; esac

echo "== Cek produksi =="
echo "  Situs: $SITUS"
echo "  API:   $API"
echo "  CDN:   $CDN"
echo

echo "Katalog"
[ "$(kode_ikut "$SITUS/")" = "200" ]        && ok "$SITUS/ = 200"        || buruk "$SITUS/ tidak 200"
[ "$(kode_ikut "$SITUS/katalog")" = "200" ] && ok "$SITUS/katalog = 200" || buruk "$SITUS/katalog tidak 200"

echo "CDN (satu file nyata dari katalog)"
# Ambil nama satu foto produk dari API publik, lalu minta file yang sama dari CDN.
# Kunci objek di R2 sama dengan jalur file PocketBase: <collectionId>/<recordId>/<nama file>.
berkas=$(curl -s --max-time 15 "$API/api/collections/produk/records?perPage=50&fields=id,collectionId,foto" 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s).items.find(x=>x.foto&&x.foto.length);console.log(r.collectionId+"/"+r.id+"/"+r.foto[0])}catch{}})' 2>/dev/null || true)
if [ -z "$berkas" ]; then
  lewati "belum ada produk berfoto di katalog (isi dulu, lalu jalankan ulang)"
else
  [ "$(kode "$CDN/$berkas")" = "200" ] && ok "File di CDN = 200 ($CDN/…/${berkas##*/})" || buruk "File di CDN tidak 200: $CDN/$berkas"
  acao=$(curl -s -o /dev/null -D - --max-time 15 -H "Origin: $SITUS" "$CDN/$berkas" 2>/dev/null | tr -d '\r' | grep -i '^access-control-allow-origin:' | head -1 | cut -d: -f2- | tr -d ' ')
  if [ "$acao" = "$SITUS" ] || [ "$acao" = "*" ]; then ok "CORS bucket mengizinkan $SITUS"; else buruk "CORS bucket R2 belum mengizinkan $SITUS (Settings → CORS Policy)"; fi
fi

echo "API"
[ "$(kode "$API/api/health")" = "200" ] && ok "/api/health = 200" || buruk "/api/health tidak 200"
# Bila Access salah dipasang di seluruh subdomain, /api/* ikut terkunci dan katalog tidak bisa checkout.
[ "$(kode "$API/api/collections/zona_ongkir/records?perPage=1")" = "200" ] \
  && ok "/api/* terbuka tanpa login (data zona ongkir terbaca)" || buruk "/api/collections/zona_ongkir tidak 200 — apakah /api/* ikut terkunci Cloudflare Access?"

echo "Panel admin"
admin=$(kode "$API/_/")
lokasi=$(curl -s -o /dev/null -D - --max-time 15 "$API/_/" 2>/dev/null | tr -d '\r' | grep -i '^location:' | head -1)
case "$admin" in
  302|301)
    if echo "$lokasi" | grep -qi 'cloudflareaccess.com'; then ok "/_/ dialihkan ke login Cloudflare Access ($admin)"
    else buruk "/_/ dialihkan ($admin) tetapi bukan ke Cloudflare Access: ${lokasi#*: }"; fi ;;
  401|403) ok "/_/ menolak tanpa login ($admin)" ;;
  200)     buruk "/_/ TERBUKA tanpa login (200). Pasang Cloudflare Access untuk path _ !" ;;
  *)       buruk "/_/ menjawab $admin (diharapkan 302 ke Access)" ;;
esac

echo "CORS"
a=$(allow_origin "$ORIGIN_ASING")
[ -z "$a" ] && ok "origin asing ditolak (tanpa header allow-origin)" || buruk "origin asing diizinkan: allow-origin=$a"
a=$(allow_origin "$SITUS")
[ "$a" = "$SITUS" ] && ok "origin $SITUS diizinkan" || buruk "origin $SITUS belum diizinkan (cek PB_ORIGINS di .env homelab, lalu docker compose up -d)"

echo "IP asli (CF-Connecting-IP)"
# 6 tebakan nomor pesanan yang tidak ada dengan IP yang sama → tebakan ke-6 harus 429.
# Lewat Cloudflare, header ini diganti IP asli pengirim; tes ini membuktikan batas per IP berjalan.
# Catatan: IP kamu sendiri terkunci untuk /api/pesanan selama 15 menit setelah cek ini.
ip_a="203.0.113.77"; k6=""
for i in 1 2 3 4 5 6; do k6=$(kode -H "CF-Connecting-IP: $ip_a" "$API/api/pesanan/CS-000000-0000?wa=9999"); done
[ "$k6" = "429" ] && ok "batas percobaan per IP berjalan (tebakan ke-6 = 429)" || buruk "tebakan ke-6 bukan 429 (kode $k6): header IP tidak terbaca atau batas tidak jalan"
if [ "$lokal" = "1" ]; then
  # Langsung ke PocketBase (tanpa Cloudflare) header bisa diatur bebas: IP lain tidak boleh ikut terkunci.
  ip_b="203.0.113.$((RANDOM % 200 + 20))"
  kb=$(kode -H "CF-Connecting-IP: $ip_b" "$API/api/pesanan/CS-000000-0000?wa=9999")
  [ "$kb" = "404" ] && ok "IP lain ($ip_b) tidak ikut terkunci (404)" || buruk "IP lain ikut terkunci atau tidak terbaca (kode $kb)"
else
  lewati "pemisahan antar-IP tidak bisa diuji lewat Cloudflare (header diganti); uji lokal: lihat docs/GO-LIVE.md bagian 5"
fi

echo
echo "== Ringkasan: $lulus lulus, $gagal gagal, $lewat dilewati =="
[ "$gagal" -eq 0 ] && exit 0 || exit 1
