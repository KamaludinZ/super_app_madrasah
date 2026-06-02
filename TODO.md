# TODO - Production Seed & Environment Behavior

- [x] Update `docker-compose.yml` agar default `ENV=production` pada backend
- [x] Update `backend/seed_data.py` agar mode production hanya seed akun admin (data lain manual)
- [x] Update `backend/server.py` agar `refresh_demo_schedule` tidak dijalankan saat production
- [x] Verifikasi endpoint app info menampilkan environment production saat deploy production
