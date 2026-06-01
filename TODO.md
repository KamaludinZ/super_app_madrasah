# TODO - Production Readiness (MongoDB + Backend + Frontend Terpisah)

- [x] Refactor `docker-compose.yml` menjadi arsitektur 3 service (+ mongodb)
- [x] Perbarui `frontend/nginx.conf` untuk proxy API ke backend internal container
- [x] Tambahkan template environment terpisah untuk backend/frontend (`.env.example`, `backend/.env.example`, `frontend/.env.example`)
- [x] Perbarui dokumentasi deploy Coolify agar mendukung arsitektur terpisah
- [x] Tambahkan panduan deploy VPS Docker Compose (step-by-step)
- [x] Validasi konsistensi konfigurasi (port, healthcheck, env, networking)
