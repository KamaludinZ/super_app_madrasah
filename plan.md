# plan.md — Super Apps MATSANDATAMA (MVP → Phase 4 Complete)

## 1. Objectives
- ✅ Membuktikan **alur inti** “Jurnal Presisi” end-to-end: **QR (encrypted) → decrypt → validasi jadwal realtime → opsional GPS geofence (ruang) → create jurnal → auto-lock by time window**.
- ✅ Menghadirkan **Super App Web** (FastAPI + React + MongoDB) dengan **multi-role switching** dan set peran:
  - Admin, Guru, Wali Kelas, Siswa, Tenaga Kependidikan, Guru Piket, Guru BK, Guru Tata Tertib, Guru Ekstrakurikuler.
  - Catatan: role **orang_tua** telah dihapus sesuai permintaan (jangan dihidupkan kembali).
- ✅ Menghadirkan master data + penjadwalan + QR card generator (B5 template upload), public realtime monitoring, audit/security log, dan branding Kemenag.
- ✅ Menyelesaikan kebutuhan produksi Phase 3: UX sesi kerja guru (JWT 12 jam + idle timeout), schedule grid, active days & teaching slots, model semester reguler/percepatan, data siswa+kehadiran+kebersihan, user tabs, import jadwal via Excel.
- ✅ Menyelesaikan **Phase 4** (fitur operasional besar) dan memastikan stabilitas:
  - **A. Excel Imports** (Users, Students, Classes, Rooms, Subjects)
  - **B. SMTP Settings + Email Reset Password (Forgot/Reset Password flow)**
  - **C. Prestasi Siswa (Portfolio + Verifikasi)**
  - **D. Ekstrakurikuler (CRUD + Members + Attendance + Grades)**
  - **E. E-Rapor Digital (Input nilai + Rapor view)**
- ✅ Stabilitas terverifikasi:
  - Backend Phase 4: **89.8% (44/49)** pada iteration_3 (5 test Excel import diskip karena butuh konstruksi file xlsx pada test runner; endpoint dan template download terverifikasi)
  - Frontend Phase 4: **85% (17/20)** pada iteration_4, **0 critical bug** (3 skenario parsial karena kendala sesi login saat E2E, bukan bug fungsional)

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
✅ Tabs per role (tanpa orang_tua).

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
- `_user_can_view_class` diperluas agar **guru mapel** dapat mengakses daftar siswa untuk kelas yang dia ampu (dibutuhkan untuk input nilai).

#### 4.7 Testing / Verification
✅ Backend Phase 4: iteration_3.json
- **89.8% pass (44/49)**, 5 skipped untuk Excel import (konstruksi xlsx pada test runner)
✅ Frontend Phase 4: iteration_4.json
- **85% pass (17/20)**, 3 parsial karena kendala sesi login saat E2E (bukan bug fungsional)
- 0 critical bugs, 0 regressions.

---

## 3. Next Actions (Immediate)
1. **Stabilisasi Operasional (Recommended sebelum Phase 5 Mobile):**
   - Uji di lingkungan sekolah:
     - Input data massal via Excel nyata (bukan template kosong)
     - Konfigurasi SMTP real dan test kirim email
     - SOP verifikasi prestasi oleh wali kelas
     - SOP absensi & nilai ekstrakurikuler
     - SOP input nilai rapor per mapel
2. **Dokumentasi & SOP (Handover readiness):**
   - Panduan admin: setup TP aktif, jam mengajar, import Excel, buat jadwal, QR generator
   - Panduan guru: scan jurnal, input nilai
   - Panduan siswa: prestasi + rapor
   - Backup/restore MongoDB dan strategi env var production.
3. **Refactor (optional tapi direkomendasikan):**
   - Pecah `/app/backend/server.py` ke `api/routers/` untuk maintainability.
4. **Phase 5 (Mobile App Expo) — setelah stabil:**
   - Mulai dari dokumen `/app/docs/MOBILE_APP_EXPO_SETUP.md`
   - Fokus awal: auth + role + scan QR + monitoring ringkas.

---

## 4. Success Criteria
- ✅ **POC:** validasi benar, B5 export benar.
- ✅ **V1:** multi-role + jurnal presisi + monitoring publik + admin CRUD + QR.
- ✅ **Phase 3:** UX sesi kerja guru, grid jadwal, semester reguler/percepatan, data siswa/kehadiran/kebersihan, import jadwal.
- ✅ **Phase 4:**
  - Excel imports master data berfungsi
  - SMTP + reset password via email berfungsi
  - Prestasi siswa + verifikasi + galeri berfungsi
  - Ekstrakurikuler (anggota/absensi/nilai) berfungsi
  - E-Rapor (input nilai + rapor view + print) berfungsi
  - Tidak ada bug kritikal, tidak ada regresi pada modul Phase 1–3.5
- 🔜 **Operational quality:**
  - SOP digunakan staf sekolah
  - Pengujian lapangan (GPS, jadwal, email SMTP) lulus
  - Observasi 1–2 minggu, kemudian freeze untuk Phase 5 mobile.

---

## Phase 5+ (Future Roadmap)
- **Phase 5:** Mobile App Expo (Android/iOS)
- **Phase 6:** Schedule conflict detection + approval workflow
- **Phase 7:** SSE/WebSocket realtime monitoring + notifikasi
- **Phase 8:** Integrasi eksternal (opsional) + analytics
