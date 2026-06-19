# TODO - Perbaikan Deploy Frontend Coolify

- [x] Audit referensi config/skrip lama terkait nginx/entrypoint (termasuk kemungkinan `emergen.sh`).
- [x] Update `frontend/Dockerfile` untuk default `BACKEND_UPSTREAM` yang aman di environment Coolify.
- [x] Update `frontend/nginx.conf` agar tidak gagal start saat `BACKEND_UPSTREAM` tidak valid/terisi.
- [x] Verifikasi konfigurasi terkait Traefik agar tidak conflict.
- [ ] Jalankan pengujian critical-path (build & run, akses `/`, cek proxy `/api/health`).
- [x] Update TODO sesuai progres.
