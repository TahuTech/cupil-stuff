#!/usr/bin/env bash
# Menyiapkan database PocketBase PRODUKSI yang bersih.
#
#   ./scripts/siapkan-produksi.sh
#
# - Menolak jalan jika pb_data sudah berisi data (menolak menimpa produksi).
# - Menjalankan migrasi: koleksi + 6 zona ongkir saja, TANPA data seed/contoh.
# - Menampilkan perintah membuat superuser (kamu yang mengetikkannya sendiri).
#
# Jangan menyalin pocketbase/pb_data dari komputer development.

set -euo pipefail

akar="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$akar"

DB="$akar/pocketbase/pb_data/data.db"

echo "== Siapkan database produksi =="

# 1) Tolak jika sudah ada database berisi data
if [ -f "$DB" ]; then
  echo
  echo "✗ $DB sudah ada."
  echo "  Jika ini database produksi yang sudah berjalan, JANGAN dihapus."
  echo "  Skrip ini hanya untuk pertama kali. Untuk memulai dari kosong (hanya di mesin baru):"
  echo "      mv pocketbase/pb_data pocketbase/pb_data.lama"
  echo
  exit 1
fi

# 2) Pastikan folder ada tapi kosong
mkdir -p "$akar/pocketbase/pb_data"
if [ -n "$(ls -A "$akar/pocketbase/pb_data" 2>/dev/null || true)" ]; then
  echo
  echo "✗ Folder pocketbase/pb_data tidak kosong:"
  ls -A "$akar/pocketbase/pb_data"
  echo "  Kosongkan dulu (pindahkan isinya), lalu jalankan skrip ini lagi."
  echo
  exit 1
fi

# 3) Jalankan PocketBase sekali agar migrasi membuat koleksi + 6 zona ongkir.
echo "Menjalankan migrasi (koleksi + 6 zona ongkir, tanpa data contoh)..."
docker compose up -d pocketbase >/dev/null 2>&1

# Tunggu siap (maks 60 detik)
for i in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://127.0.0.1:8090/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS --max-time 3 "http://127.0.0.1:8090/api/health" >/dev/null 2>&1; then
  echo "✗ PocketBase tidak siap. Cek: docker compose logs pocketbase"
  exit 1
fi

echo "✓ PocketBase jalan dan migrasi selesai."

# 4) Verifikasi: koleksi ada, zona ongkir terisi 6, dan tidak ada data produk/jasa
zona=$(curl -fsS "http://127.0.0.1:8090/api/collections/zona_ongkir/records?perPage=1" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
echo "  Zona ongkir: ${zona:-0} baris (harus 6)"

# pesanan dan tiket_servis tertutup untuk publik (hanya superuser), jadi dicek lewat panel admin nanti.
for k in kategori produk varian jasa portofolio; do
  n=$(curl -sS --max-time 5 "http://127.0.0.1:8090/api/collections/$k/records?perPage=1" 2>/dev/null | grep -o '"totalItems":[0-9]*' | cut -d: -f2 || true)
  if [ -z "${n:-}" ]; then echo "  $k: tidak bisa dicek lewat API publik (cek di panel admin, harus 0)"; else echo "  $k: $n baris (harus 0)"; fi
done
echo
echo "== Langkah berikutnya (kamu yang mengetik) =="
echo "Buat akun superuser. Ketik email dan password sendiri; perintah di bawah tidak"
echo "menyimpan password di riwayat shell dan tidak mencetaknya:"
echo
echo '  read -rp "Email superuser: " EM; read -rsp "Password: " PW; echo'
echo '  docker compose exec -T pocketbase /pb/pocketbase superuser upsert "$EM" "$PW" --dir=/pb/pb_data; unset PW'
echo
echo "Lalu isi .env homelab (lihat .env.example) dan jalankan:"
echo "  node scripts/siapkan-pocketbase.mjs"
echo
