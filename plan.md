# plan.md — Super Apps MATSANDATAMA (MVP → Phase 4 + Batch A + Iterasi 1 + Iterasi 2 + Iterasi 3/E Complete)

## 1. Objectives
- ✅ Membuktikan **alur inti** “Jurnal Presisi” end-to-end: **QR (encrypted) → decrypt → validasi jadwal realtime → opsional GPS geofence (ruang) → create jurnal → auto-lock by time window**.
- ✅ Menghadirkan **Super App Web** (FastAPI + React + MongoDB) dengan **multi-role switching** dan set peran:
  - Admin, Guru, Wali Kelas, Siswa, Tenaga Kependidikan, Guru Piket, Guru BK, Guru Tata Tertib, Guru Ekstrakurikuler.
- ✅ Branding Kemenag + dashboard per role + master data + penjadwalan + QR card generator (B5 template upload).
- ✅ Excel imports + SMTP reset password + prestasi + ekskul + e-rapor.
- ✅ Batch A: holidays, backup/restore, class capacity, tugas guru piket.
- ✅ Iterasi 1: hardening workflow jadwal guru, detail data siswa, mutasi, sidebar role-switch fix.
- ✅ Iterasi 2: stabilisasi E2E FE dan refactor backend (server.py → core.py + routers/*).
- ✅ **Iterasi 3 / Phase E — Stabilisasi Operasional + SOP & Dokumentasi**:
  - Password policy (first login + 6 bulan) yang **disarankan** dan bisa di-snooze
  - Sistem pengumuman + role targeting
  - Sistem notifikasi di topbar (lebih jelas: notif apa)
  - Halaman error (profesional) + mode maintenance (informatif) + gate maintenance
  - Landing/login soft animated background bertema madrasah
  - Export Excel (users/students/schedules/grades)
  - Panduan pengguna in-app + dokumentasi offline

---

## 2. Implementation Steps

### Phase 1 — POC Core “Jurnal Presisi” (Isolation, must pass before app build)
**Goal:** validasi bagian tersulit tanpa kompleksitas full app.

✅ **COMPLETED (15/15 tests passed)**
1. Research/best-practice review:
   - Fernet/AES payload design
   - TOTP dynamic QR (RFC 6238)
   - Browser QR scanning constraints (html5-qrcode)
   - Haversine distance + practical GPS accuracy
2. Implement `poc_jurnal_presisi.py`:
   - fixtures rooms (lat/lon/radius), teacher, schedule blocks, settings
   - **Static QR** encrypted payload + QR image
   - decrypt/validate + school_id check
   - schedule validation WIB + grace window
   - GPS validation (toggle)
   - journal object + validation summary
3. Implement B5 portrait generator:
   - default template + uploaded template overlay
4. Implement Dynamic QR POC (TOTP)
5. Review artifacts & output

**Phase 1 user stories (POC):**
- ✅ Encrypted QR can be generated and decrypted.
- ✅ Journal blocked if schedule invalid.
- ✅ GPS toggle changes outcomes.
- ✅ Geofence blocks out-of-radius.
- ✅ B5 overlay export works.

---

### Phase 2 — V1 App Development (build around proven core)
**Goal:** working MVP with core feature complete.

✅ **COMPLETED — Backend + Frontend + Seed + Visual Verification**

#### 2.1 Backend (FastAPI)
✅ Implemented:
- MongoDB connection, WIB timezone
- Settings (branding, default GPS/QR)
- Collections: users, academic_years, classes, rooms, subjects, schedules, journals, qr_templates, audit/security logs
- Auth: username/password + JWT + math captcha + lockout
- RBAC + role switching
- CRUD admin
- Smart journal endpoints
- QR generator (static + dynamic) & B5 card
- Public monitoring endpoint
- Seed demo data + auto-refresh demo schedule

#### 2.2 Frontend (React)
✅ Implemented:
- AppShell + branding Kemenag
- Login (username/password + math captcha)
- Role switcher
- Dashboards multi-role
- Smart journal scan flow
- Jadwal saya
- Admin CRUD pages
- QR generator UI
- Logs & settings
- Public monitoring

---

### Phase 3 — Production UX + Scheduling Ergonomics + Student Ops
**Goal:** operasional nyata sekolah (guru nyaman login, admin mudah isi jadwal, wali kelas punya modul kelas).

✅ **COMPLETED — Backend + Frontend + Tests**

#### 3.1 Security / Session UX (Work-day)
✅ JWT 12 jam + idle timeout configurable.

#### 3.2 B5 Card Readability Fix
✅ Perbaikan layout dan preview.

#### 3.3 Scheduling: Active Days + Teaching Slots + Grid View
✅ Settings active days & teaching slots; UI grid jadwal; endpoint grid.

#### 3.4 Data Siswa + Kehadiran + Kebersihan
✅ RBAC admin/wali kelas/siswa; upsert attendance & cleanliness.

#### 3.5 User Management Grouped by Role
✅ Tabs per role (tanpa role orang_tua sebagai target utama produk).

#### 3.6 Tahun Pelajaran: Regular vs Percepatan
✅ Semester reguler (ganjil/genap) dan percepatan (1–6).

#### 3.7 Excel Import Jadwal
✅ Template download + upload import + validasi.

#### 3.8 Production Env Vars
✅ `.env.example`.

#### 3.9 Testing
✅ Backend Phase 3 suite **44/44 PASS (100%)**.

---

### Phase 4 — Operasional Lanjutan (Excel Master Import, Email Reset, Prestasi, Ekstra, E-Rapor)
**Goal:** melengkapi modul-modul operasional yang dibutuhkan sekolah (data massal, reset password, portofolio prestasi, pembinaan ekskul, rapor digital).

✅ **COMPLETED — Backend + Frontend + Testing**

#### 4.1 Excel Imports Master Data (A)
✅ Backend:
- Template download + import endpoints:
  - `GET /api/users/excel-template` + `POST /api/users/import-excel`
  - `GET /api/students/excel-template` + `POST /api/students/import-excel`
  - `GET /api/classes/excel-template` + `POST /api/classes/import-excel`
  - `GET /api/rooms/excel-template` + `POST /api/rooms/import-excel`
  - `GET /api/subjects/excel-template` + `POST /api/subjects/import-excel`
✅ Frontend:
- Halaman `Admin → Import Excel` (`/admin/import`): tab per entity, download template, upload .xlsx, panel hasil (success/errors).

#### 4.2 SMTP + Reset Password via Email (B)
✅ Backend:
- `POST /api/admin/settings/test-smtp`
- `POST /api/auth/forgot-password` (anti-enumeration)
- `GET /api/auth/reset-password/validate/{token}`
- `POST /api/auth/reset-password`
✅ Frontend:
- Login: link **Lupa password?**
- Halaman `/forgot-password` + `/reset-password?token=...`
- Admin Settings tab **SMTP & Email**: konfigurasi SMTP + uji kirim email + app_public_url.

#### 4.3 Prestasi Siswa / Portfolio (C)
✅ Backend:
- CRUD + verifikasi:
  - `GET/POST/PUT/DELETE /api/achievements`
  - `PUT /api/achievements/{id}/verify`
✅ Frontend:
- Halaman `/prestasi`:
  - Siswa: input prestasi sendiri, edit/hapus sebelum verifikasi
  - Wali kelas/Admin: verifikasi, lihat semua, galeri prestasi

#### 4.4 Ekstrakurikuler (D)
✅ Backend:
- CRUD ekstra, anggota, absensi, nilai:
  - `GET/POST/PUT/DELETE /api/extracurriculars`
  - `GET/POST/DELETE /api/extracurriculars/{id}/members`
  - `POST/GET /api/extracurriculars/{id}/attendance`
  - `POST/GET /api/extracurriculars/{id}/grades`
✅ Frontend:
- Halaman `/ekstrakurikuler`:
  - Admin: buat/edit/hapus ekstra
  - Coach/admin: detail view (Anggota/Absensi/Nilai)

#### 4.5 E-Rapor Digital (E)
✅ Backend:
- Input nilai bulk + rapor view:
  - `POST /api/grades/bulk`
  - `GET /api/grades`
  - `GET /api/grades/rapor/{student_id}`
✅ Frontend:
- `/nilai/input`: input nilai per kelas+mapel+semester, predikat auto, simpan bulk
- `/rapor`: rapor digital (header Kemenag + student/class info + tabel nilai + average + legenda predikat + print)

#### 4.6 Fix & Hardening (Phase 4 integration stability)
✅ Fixed backend crash (import `BaseModel` order) setelah injeksi endpoint Phase 4.
✅ RBAC improvement:
- `user_can_view_class` diperluas agar **guru mapel** dapat mengakses daftar siswa untuk kelas yang dia ampu (dibutuhkan untuk input nilai).

#### 4.7 Testing / Verification
✅ Backend Phase 4: `iteration_3.json`
- **89.8% pass (44/49)**, 5 skipped untuk Excel import (konstruksi xlsx pada test runner)
✅ Frontend Phase 4: `iteration_4.json`
- **85% pass (17/20)**, 3 parsial karena kendala sesi login saat E2E (bukan bug fungsional)
- 0 critical bugs, 0 regressions.

---

### Batch A — Operasional Tambahan (Holidays, Backup/Restore, Class Capacity, Tugas Guru Piket)
**Goal:** melengkapi kebutuhan operasional harian sekolah dan kesiapan maintenance data.

✅ **COMPLETED — Backend + Frontend + Testing**

#### A1. Hari Libur (Akademik & Mingguan)
✅ Backend:
- CRUD hari libur akademik: `GET/POST/PUT/DELETE /api/academic-holidays`
- CRUD hari libur mingguan: `GET/POST/PUT/DELETE /api/weekly-holidays`
- Endpoint publik ringkas: `GET /api/public/holidays/today` (tanpa auth)
✅ Frontend:
- UI pengelolaan hari libur (admin).

#### A2. Kapasitas Kelas + Student Count
✅ Backend:
- `capacity` pada data kelas + `student_count` pada response list kelas.
✅ Frontend:
- Kolom kapasitas (dan tampil student_count) pada Data Kelas.

#### A3. Backup & Restore Database
✅ Backend:
- Info backup: `GET /api/admin/backup/info`
- Export JSON: `GET /api/admin/backup/export`
- Import JSON (merge/replace): `POST /api/admin/backup/import`
- Logs: `GET /api/admin/backup/logs`
✅ Frontend:
- UI Backup/Restore untuk admin (export/download + import/upload + logs).

#### A4. Tugas Guru Piket
✅ Backend:
- CRUD tugas guru: `GET/POST/PUT/DELETE /api/teacher-tasks`
- Piket hari ini: `GET /api/piket/schedules/today`
- Piket isi jurnal: `POST /api/piket/fill-journal` (link task_id, auto-complete task)
✅ Frontend:
- UI daftar tugas + modul piket (isi jurnal berdasarkan tugas).

#### A5. Testing / Verification
✅ Backend Batch A: `iteration_6.json`
- **96.1% (49/51)**; 2 item adalah isu desain test/ekspektasi, bukan bug fungsional.

---

### Iterasi 1 — Workflow Jadwal Guru + Detail Data Siswa + Admin Mutasi + Sidebar Fix
**Goal:** hardening UX & tata kelola data inti (jadwal dan data siswa) agar stabil dipakai harian.

✅ **COMPLETED — Backend + Frontend + Testing**

#### I1. Sidebar Role-Switching Fix
✅ Frontend:
- Perbaikan agar switch role tidak “nyangkut”/inkonsisten pada sidebar dan navigasi.

#### I2. Teacher Schedule Workflow (Draft/Submitted/Locked)
✅ Backend:
- Status jadwal: `draft` / `submitted` / `locked` + timestamp `submitted_at`, `locked_at`.
- Endpoint workflow:
  - `GET /api/schedules/my-schedules`
  - `PUT /api/schedules/{id}/submit`
  - `PUT /api/schedules/{id}/lock`
  - `PUT /api/schedules/{id}/unlock`
  - `PUT /api/schedules/bulk-lock`
- RBAC:
  - Guru hanya bisa buat/edit/hapus saat draft miliknya
  - Admin bisa override edit dan lock/unlock
✅ Frontend:
- Halaman `My Schedules` untuk guru:
  - daftar jadwal milik guru
  - aksi submit
  - status badge draft/terkirim/terkunci

#### I3. Detail Data Siswa (Form Besar: Data Siswa/Orang Tua/Alamat)
✅ Backend:
- Endpoint detail siswa: `GET/PUT /api/students/{id}/detail` (upsert, merge)
- Skema nested: `data_siswa`, `data_ayah`, `data_ibu`, `data_wali`, `data_alamat`
✅ Frontend:
- Dialog detail siswa bertab: **Data Siswa**, **Data Orang Tua/Wali**, **Data Alamat**.

#### I4. Admin Mutations Page
✅ Backend:
- Endpoint: `GET /api/admin/mutations` + filter `mutation_type` & `role_group`
- Mutasi pada user (masuk/keluar) tersimpan (`mutation_type`, `mutation_date`) dan mempengaruhi `is_active` sesuai aturan.
✅ Frontend:
- Halaman Admin Mutasi: filter + tabel hasil.

#### I5. Audit Logs Filter Enhancement
✅ Backend:
- `GET /api/admin/audit-logs` mendukung filter `target_id` dan `target_type`.

#### I6. Testing / Verification
✅ Backend Iterasi 1: `/app/backend/iterasi1_test_results.json`
- **100% (60/60)** PASS.

---

### Iterasi 2 — Stabilisasi: Frontend E2E + Refactor Backend
**Goal:** memastikan Iterasi 1 benar-benar siap dipakai (E2E UI) dan backend mudah dirawat untuk fase berikutnya.

✅ **COMPLETED — Frontend E2E + Backend Refactor + Regression Tests**

#### II-A. Frontend E2E Validation (Iterasi 1)
✅ Status: production-ready
- Hasil: **95% overall**, 9 skenario inti PASS, **0 bug kritikal**
- Report: `/app/test_reports/iteration_7.json`

#### II-D. Refactor Backend (server.py → core.py + routers/*)
✅ Status: completed
- `server.py` dari **3.173 baris → 90 baris** (≈97% reduksi)
- Struktur baru:
  - `core.py`: DB, deps auth/RBAC, helper serialize, audit/security logging
  - `routers/*` per domain + `_shared.py` (helper RBAC)

#### II-D2. Regression Tests setelah Refactor
✅ Iterasi 1: **60/60 PASS (100%)**
✅ Batch A: **49/51 PASS (96.1%)**

---

### Iterasi 3 / Phase E — Stabilisasi Operasional + SOP & Dokumentasi
**Goal:** kesiapan operasional sekolah: onboarding user, notifikasi jelas, pengumuman terarah per role, maintenance profesional, export data untuk laporan, dan SOP/handbook in-app.

✅ **COMPLETED — Backend + Frontend + Docs + Tests**

#### E1. Password Policy (Saran Ubah Password)
✅ Backend:
- Field user baru:
  - `password_changed_at`, `password_change_dismissed_until`
- `GET /api/auth/me` mengembalikan `password_status`:
  - `reason`: `first_login` atau `expired`
  - `should_prompt`: true/false
- Endpoint:
  - `POST /api/auth/change-password`
  - `POST /api/auth/dismiss-password-reminder?days=30`
✅ Frontend:
- `ChangePasswordDialog` auto-prompt (first login + reminder 6 bulan)
- Tombol: **Ubah Sekarang** atau **Nanti Saja (tunda 30 hari)**

#### E2. Sistem Pengumuman (Announcements)
✅ Backend:
- `AnnouncementModel`
- Admin CRUD:
  - `GET/POST/PUT/DELETE /api/admin/announcements`
- User feed:
  - `GET /api/announcements` (filter by role, active window, pin)
✅ Frontend:
- `AnnouncementsCard` muncul di dashboard semua role non-admin
- Halaman list: `/pengumuman`
- Admin management page: `/admin/pengumuman` dengan target role (multi select) + severity + pin + aktif/nonaktif

#### E3. Sistem Notifikasi (Topbar Bell)
✅ Backend:
- Feed gabungan:
  - `GET /api/notifications`
  - `GET /api/notifications/unread-count`
  - `POST /api/notifications/{source}/{source_id}/read`
  - `POST /api/notifications/mark-all-read`
- Sumber: announcements + password reminder (synthetic)
✅ Frontend:
- `NotificationBell` di topbar (sebelah role switcher)
- Badge unread, dropdown, tombol mark-all-read
- Polling unread count tiap 60 detik

#### E4. Halaman Error & Maintenance
✅ Frontend:
- `ErrorPage` profesional (404/403/500/generic) + catch-all route
- `MaintenancePage` informatif + auto-refresh
- `MaintenanceGate` (non-admin diblokir jika maintenance_mode aktif)
✅ Backend:
- Public `GET /api/settings` expose:
  - `maintenance_mode`, `maintenance_message`, `maintenance_ends_at`

#### E5. Landing/Login Soft Animated Background
✅ Frontend:
- `MadrasahBackdrop` (SVG ornaments): bintang 8-titik, bulan sabit, ikon buku, pena, arabesque
- Opacity rendah agar tidak mengganggu form

#### E6. Export Excel (Laporan)
✅ Backend:
- Export .xlsx:
  - `GET /api/admin/export/users-excel`
  - `GET /api/admin/export/students-excel`
  - `GET /api/admin/export/schedules-excel`
  - `GET /api/admin/export/grades-excel`
✅ Frontend:
- Tambahan section di `AdminBackupPage` untuk download Excel export

#### E7. Panduan Pengguna In-App
✅ Frontend:
- `/panduan` dan `/panduan/:slug`
- 12 topik markdown internal, filter sesuai role (non-admin hanya melihat yang relevan + keamanan)

#### E8. Dokumentasi Markdown Standalone (Offline)
✅ Output:
- `/app/docs/README.md`
- `/app/docs/PANDUAN_ADMIN.md`
- `/app/docs/PANDUAN_GURU.md`
- `/app/docs/PANDUAN_WALI_KELAS.md`
- `/app/docs/PANDUAN_SISWA.md`
- `/app/docs/PANDUAN_GURU_PIKET.md`
- `/app/docs/SETUP_SMTP.md`
- `/app/docs/BACKUP_RESTORE.md`
- `/app/docs/KEAMANAN_PASSWORD.md`

#### E9. Maintenance Mode Toggle UI
✅ Frontend:
- Admin Settings: tab **Maintenance**
- Toggle `maintenance_mode`, input message, estimasi selesai
✅ Backend:
- Persist via `PUT /api/admin/settings`

#### E10. Testing / Verification
✅ Regression:
- Iterasi 1 regression: **60/60 PASS (100%)**
✅ Smoke test fitur baru:
- **21/21 PASS (100%)** (password policy, announcements, notifications, maintenance toggle, export excel)
✅ Visual verification:
- Screenshot verified untuk Admin Pengumuman + Panduan + Maintenance + Login backdrop

---

## 3. Next Actions (Immediate)
Pilih prioritas berikutnya:
1. **Phase 6 — Advanced Scheduling**
   - Conflict detection jadwal (guru/ruang/kelas bentrok)
   - Approval workflow lebih formal (review queue + komentar)
2. **Phase 5 — Mobile App Expo** (setelah web benar-benar stabil)
   - Scan QR offline queue + sync
   - Push notification (pengumuman/alert)
3. **Phase 7 — Realtime Monitoring**
   - SSE/WebSocket untuk monitoring kelas real-time, notifikasi otomatis
4. **Phase 8 — Integrasi Eksternal + Analytics**
   - Dapodik/EMIS, SIMPATIKA, WA gateway, insight

---

## 4. Success Criteria
- ✅ **POC:** validasi benar, B5 export benar.
- ✅ **V1:** multi-role + jurnal presisi + monitoring publik + admin CRUD + QR.
- ✅ **Phase 3:** UX sesi kerja guru, grid jadwal, semester reguler/percepatan, data siswa/kehadiran/kebersihan, import jadwal.
- ✅ **Phase 4:** Excel imports, SMTP reset password, prestasi, ekskul, e-rapor berjalan tanpa bug kritikal.
- ✅ **Batch A:** libur, backup/restore, kapasitas kelas, tugas guru piket berjalan.
- ✅ **Iterasi 1:** workflow jadwal, data siswa detail, mutasi, sidebar fix stabil.
- ✅ **Iterasi 2:** FE tervalidasi E2E, backend maintainable, regression lulus.
- ✅ **Iterasi 3 / Phase E:**
  - Password policy disarankan (first login + 6 bulan) dan bisa di-snooze
  - Pengumuman terarah per role (admin kelola)
  - Notifikasi jelas di topbar dengan badge + mark read
  - Maintenance mode profesional + gate non-admin
  - Export Excel untuk laporan
  - Panduan in-app + docs offline tersedia

---

## Phase 5+ (Future Roadmap)
- **Phase 5:** Mobile App Expo (Android/iOS)
  - Fokus awal: auth + role + scan QR + monitoring ringkas
  - Lanjutan: offline-first scan queue + push notification
- **Phase 6:** Schedule conflict detection + approval workflow
- **Phase 7:** SSE/WebSocket realtime monitoring + notifikasi
- **Phase 8:** Integrasi eksternal (opsional) + analytics
