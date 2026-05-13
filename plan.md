# plan.md — Super Apps MATSANDATAMA (MVP → Phase 3 Complete)

## 1. Objectives
- ✅ Prove **core workflow** “Jurnal Presisi” works end-to-end: **QR (encrypted) → decrypt → schedule validation → optional GPS geofence (room-based) → journal create → auto-lock by time window**.
- ✅ Deliver V1 web app (FastAPI + React + MongoDB) with **multi-role switching** and role set:
  - Admin, Guru, Wali Kelas, Siswa, Tenaga Kependidikan, Guru Piket, Guru BK, Guru Tata Tertib, Guru Ekstrakurikuler **(+ Ortu/Wali)**.
- ✅ Provide master data management, scheduling, **QR card generator (B5 template upload)**, parent/student views, **public realtime monitoring page**, audit/security logs, and branding settings.
- ✅ Extend to Phase 3 (as requested):
  - **Work-day session UX** (login tetap nyaman untuk guru) via **JWT 12 jam + idle timeout 30 menit** (configurable).
  - **Schedule grid** per hari aktif + slot jam (filter per guru/per kelas) + input jadwal lebih mudah.
  - **Active days & teaching slots** configurable in settings.
  - **Semester model** mendukung **regular (ganjil/genap)** & **percepatan (semester 1–6)**.
  - **Data Siswa + Kehadiran + Kebersihan** untuk Admin & Wali Kelas (RBAC).
  - **User management grouping by role** (tabs per role).
  - **Excel import jadwal** (template download + upload + validation).
  - **Production env vars guidance** via `.env.example`.
- ✅ Confirm stability with incremental testing + regression:
  - Backend Phase 3 suite **44/44 PASS (100%)**.
- 🔜 Transition objective: finalize “Release Notes + Deployment readiness + operational SOP” (backup/restore, admin guide) for handover.

---

## 2. Implementation Steps

### Phase 1 — POC Core “Jurnal Presisi” (Isolation, must pass before app build)
**Goal:** validate hardest parts without full app complexity.

✅ **COMPLETED (15/15 tests passed)**
1. Research/best-practice review:
   - Fernet/AES payload design
   - TOTP dynamic QR (RFC 6238)
   - Browser QR scanning constraints (html5-qrcode)
   - Haversine distance + practical GPS accuracy
2. Implement `poc_jurnal_presisi.py`:
   - In-memory fixtures: rooms (lat/lon, radius), teacher, schedule blocks, settings
   - **Static QR** encrypted payload + QR image
   - Decrypt/validate + school_id check
   - **Schedule validation** with WIB + grace window
   - **GPS validation** with toggle
   - Journal creation object + validation summary
3. Implement B5 portrait generator:
   - Default template + uploaded template overlay
4. Implement Dynamic QR POC (TOTP):
   - Generate TOTP + validate with window
5. Review artifacts:
   - Generated QR images + B5 overlay preview

**Phase 1 user stories (POC):**
- ✅ Encrypted QR can be generated and decrypted.
- ✅ Journal is blocked if schedule invalid.
- ✅ GPS toggle changes outcomes.
- ✅ Geofence blocks out-of-radius.
- ✅ B5 overlay export works.

---

### Phase 2 — V1 App Development (build around proven core)
**Goal:** working MVP with core feature complete; dynamic QR visible but static is primary.

✅ **COMPLETED — Backend + Frontend + Seed + Visual Verification**

#### 2.1 Backend (FastAPI)
✅ Implemented:
1. Project config + runtime:
   - MongoDB connection, WIB timezone
   - global settings collection (branding, gps default, qr default)
2. Data model/collections:
   - users (roles[], multi-role)
   - academic_years
   - classes
   - rooms (gps_lat/gps_lon, radius, gps_enabled toggle, qr_mode, qr_secret)
   - subjects
   - schedules (enriched listing)
   - journals (validations stored)
   - qr_templates (B5 background)
   - audit_logs + security_logs
   - settings (branding)
3. Authentication & security:
   - Username/password (bcrypt)
   - JWT with `active_role`
   - Math captcha endpoints
   - rate-limit + lockout after failed attempts
4. RBAC + multi-role switching:
   - `/auth/switch-role` issues new JWT
5. Master data CRUD (admin):
   - academic years
   - users
   - classes
   - rooms
   - subjects
   - schedules
6. Smart Journal endpoints:
   - `/jurnal/validate` (QR + schedule + GPS)
   - `/jurnal` create journal (duplicate prevention)
   - `/jurnal/my` history
7. QR Management:
   - static encrypted QR per room
   - dynamic QR (TOTP) supported
   - upload B5 template + generate printable PNG card
8. Public Monitoring (no auth):
   - `/public/monitoring` with stats + schedule status
9. Logging:
   - audit logs for CRUD + role switch
   - security logs for login/captcha/lockout/journal blocks
10. Seed data:
   - demo users covering all roles + multi-role examples
   - classes, rooms (GPS), subjects
   - schedules + 1 sample journal
   - **startup auto-refresh** ensures always an “active-now” demo schedule exists (avoids time-dependent demo failures)

✅ Notable fixes after automated testing:
- Improve validation structure default reasons (“Belum diperiksa”) when step not reached.
- Ensure active academic year stays aligned with demo schedules after automated tests.

#### 2.2 Frontend (React)
✅ Implemented:
1. App shell + theme:
   - Kemenag green theme, Plus Jakarta Sans font
   - mobile responsive layout
2. Login:
   - username/password + math captcha
3. Role switcher:
   - multi-role dropdown; updates active role token
4. Role dashboards:
   - Admin dashboard with stats + quick actions
   - Guru dashboard (today schedule + CTA to journal)
   - Wali Kelas dashboard (class journal status + student list)
   - Siswa dashboard (today schedule + journal read-only)
   - Ortu dashboard (switch child + see journals)
   - Staff dashboard (tendik/piket/bk/tatib/ekstra landing)
5. Smart Journal flow:
   - QR scan via camera (html5-qrcode)
   - fallback manual token validation
   - show 3-layer validation result + journal form
6. Jadwal:
   - today + weekly view (teacher or student)
7. Admin CRUD pages:
   - Users/Classes/Rooms/Subjects/Schedules/Academic Year
8. Admin QR Generator:
   - generate QR, generate B5 card, preview + download
   - template upload management
9. Admin logs + settings:
   - Audit/Security logs viewer
   - Branding settings + logo upload
10. Public monitoring page:
   - live indicator + clock + stats + filter tabs + grid

✅ Visual verification:
- Teacher manual token validation confirmed: **3 green checkmarks** and journal form displayed.

**Phase 2 user stories (V1):**
- ✅ Admin can create multi-role users and users can switch role after login.
- ✅ Admin can set GPS center+radius per room and toggle GPS enforcement.
- ✅ Teacher can scan/validate QR and only open form if valid.
- ✅ Public visitors can view realtime journal status.
- ✅ Admin can upload B5 template and download QR cards.

**End of Phase 2:**
- ✅ Backend automated suite reached 97.1% initially; post-fix validation clarity improved.
- ✅ Core teacher journal flow verified visually.

---

### Phase 3 — Production UX + Scheduling Ergonomics + Student Ops (Requested Enhancements)
**Goal:** complete requested improvements for real-world operations (guru mudah login, jadwal mudah diisi, modul wali kelas/admin bertambah).

✅ **COMPLETED — Backend + Frontend + Backfill + Tests**

#### 3.1 Security / Session UX (Work-day)
✅ Implemented:
- JWT default session updated to **12 jam** (`JWT_EXPIRY_MINUTES = 720`).
- **Idle timeout auto-logout** (default 30 menit) dengan notifikasi toast.
- Konfigurasi via **Admin → Pengaturan → Sesi & Keamanan**:
  - `session_max_hours`
  - `idle_timeout_minutes`
- Login response kini mengembalikan `expires_in_minutes` dan `idle_timeout_minutes`.

#### 3.2 B5 Card Readability Fix
✅ Implemented:
- Perbaikan layout & ukuran font pada kartu B5:
  - Class name besar (≈200px), label ruangan 56px, header 64px.
- Preview di UI diperbesar (lebih proper untuk review sebelum print).

#### 3.3 Scheduling: Active Days + Teaching Slots + Grid View
✅ Implemented:
- **Settings baru**:
  - `active_days`: hari aktif sekolah (Senin–Sabtu)
  - `teaching_slots`: template jam mengajar (termasuk slot istirahat)
- **Schedule grid view** pada `/admin/schedules`:
  - Filter **per kelas / per guru**
  - Tampilan **Grid (Hari & Jam)** + tab **List**
  - Klik slot kosong → dialog tambah jadwal pre-filled (hari + jam)
- Endpoint baru:
  - `GET /api/schedules/grid`

#### 3.4 Data Siswa + Kehadiran + Kebersihan Kelas
✅ Implemented:
- Menu baru tersedia untuk **Admin** dan **Wali Kelas**:
  - **Data Siswa** (`/admin/siswa`, `/wali-kelas/siswa`)
  - **Kehadiran Siswa** (`/admin/kehadiran`, `/wali-kelas/kehadiran`)
  - **Kebersihan Kelas** (`/admin/kebersihan`, `/wali-kelas/kebersihan`)
- RBAC:
  - Admin: akses semua kelas
  - Wali kelas: hanya kelas wali
  - Siswa (role tunggal): hanya dirinya
- Backend endpoints baru:
  - `GET /api/students`
  - `GET/POST /api/attendance/class/{class_id}` + upsert by (class_id,date)
  - `GET/POST /api/cleanliness/class/{class_id}` + upsert by (class_id,date)

#### 3.5 User Management Grouped by Role
✅ Implemented:
- Halaman Pengguna menggunakan **Tabs per Role** dengan badge count:
  - Semua, Admin, Guru, Wali Kelas, Siswa, Orang Tua, Tendik, Piket, BK, Tatib, Ekstra

#### 3.6 Tahun Pelajaran: Regular vs Percepatan (Semester 1–6)
✅ Implemented:
- Academic year mendukung:
  - `semester_type = regular` → semester ganjil/genap
  - `semester_type = accelerated` → semester 1–6
- UI menampilkan tipe + badge semester aktif
- Field baru:
  - `active_semester`

#### 3.7 Excel Import Jadwal
✅ Implemented:
- Download template Excel:
  - `GET /api/schedules/excel-template` (sheet Jadwal + INSTRUKSI + contoh baris)
- Upload/import:
  - `POST /api/schedules/import-excel` (validasi referensi kelas/mapel/guru/ruang)
  - return `{success, errors[], total_rows}`
- UI:
  - Tombol Template Excel + Import Excel pada `/admin/schedules`

#### 3.8 Production Environment Variables
✅ Implemented:
- Added `/app/backend/.env.example` covering:
  - `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`
  - `JWT_SECRET`
  - `QR_MASTER_SECRET`
  - `SCHOOL_ID`

#### 3.9 Testing / Verification
✅ Completed:
- Backend Phase 3 suite: **44/44 PASS (100%)**
- Frontend visual verification for:
  - Settings Workday tab
  - Schedules grid
  - Users role tabs
  - Data Siswa / Kehadiran
  - B5 card preview

**End of Phase 3:**
- ✅ 1 full backend regression pass with no failures.

---

## 3. Next Actions (Immediate)
1. **Handover checklist (recommended next):**
   - finalize credentials list, demo data guide, environment vars
   - write admin SOP: create user, create room + GPS, create schedule, generate QR card, use monitoring
2. **Production readiness:**
   - set **MONGO_URL**, **JWT_SECRET**, **QR_MASTER_SECRET**, **CORS_ORIGINS** (specific domains)
   - decide QR secret rotation strategy if using dynamic QR
   - backup/restore strategy for MongoDB
3. **GPS operational setup:**
   - input GPS lat/lon per ruangan dari pengukuran onsite
   - set radius per room (recommend 20–50m)
   - decide which rooms enable GPS enforcement
4. **Schedule operations:**
   - configure active days  teaching slots template
   - fill schedules via grid or Excel import

---

## 4. Success Criteria
- ✅ **POC:** all validations pass/fail correctly with clear reasons; B5 overlay export renders correctly.
- ✅ **V1:**
  - Multi-role login + role switching works.
  - Teacher journal only created via validated QR + schedule + optional GPS.
  - Public monitoring accurately reflects schedule and filled status.
  - Admin can manage master data, generate QR cards with template, view logs, and change branding.
- ✅ **Phase 3:**
  - Work-day session UX: 12h session + idle logout configurable.
  - Schedule grid: per guru/per kelas, days  slot template.
  - Academic year supports regular and accelerated semester models.
  - Data siswa/kehadiran/kebersihan available with correct RBAC.
  - Excel import/export template works with validation.
  - Backend regression pass: 44/44.
- 🔜 **Operational quality:**
  - admin guide + SOP available
  - one full end-to-end UX regression (frontend) before public launch

---

## Phase 4+ (Future Roadmap)
- E-Rapor digital
- Prestasi siswa (portfolio)
- Ekstrakurikuler advanced module
- Email reset password (SMTP)
- Mobile app (React Native/Expo)
- Schedule conflict detection + approval workflow
- SSE/WebSocket realtime monitoring
