#!/bin/sh
# Tambahkan `listen [::]:80;` bila kernel container mendukung IPv6. Healthcheck Coolify memakai host `localhost`, yang
# di banyak server di-resolve ke ::1 lebih dulu; tanpa listen IPv6 permintaan itu ditolak (connection refused) dan
# container dianggap tidak sehat. Bila IPv6 tidak tersedia, baris ini TIDAK ditambahkan (nginx akan gagal start bila
# listen IPv6 dipaksakan tanpa dukungan kernel).
set -e
CONF="${NGINX_SUPERAPP_CONF:-/etc/nginx/conf.d/default.conf}"
[ -f /proc/net/if_inet6 ] || { echo "30-superapp-listen-ipv6: IPv6 tidak tersedia, hanya listen IPv4"; exit 0; }
[ -f "$CONF" ] || exit 0
grep -q 'listen \[::\]:80;' "$CONF" && exit 0
touch "$CONF" 2>/dev/null || { echo "30-superapp-listen-ipv6: $CONF tidak dapat diubah"; exit 0; }
sed -i 's/^\([[:space:]]*\)listen 80;/&\n\1listen [::]:80;/' "$CONF"
echo "30-superapp-listen-ipv6: listen [::]:80 ditambahkan"
