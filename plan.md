# plan.md — Super Apps MATSANDATAMA (MVP)

## 1. Objectives
- ✅ Prove **core workflow** “Jurnal Presisi” works end-to-end: **QR (encrypted) → decrypt → schedule validation → optional GPS geofence (room-based) → journal create → auto-lock by time window**.
- ✅ Deliver V1 web app (FastAPI + React + MongoDB) with **multi-role switching** and role set:
  - Admin, Guru, Wali Kelas, Siswa, Tenaga Kependidikan, Guru Piket, Guru BK, Guru Tata Tertib, Guru Ekstrakurikuler **(+ Ortu/Wali sebagai role akses orang tua)**.
- ✅ Provide master data management, scheduling, **QR card generator (B5 template upload)**, parent/student views, **public realtime monitoring page**, audit/security logs, and branding settings.
- ✅ Ensure stability with incremental testing; confirm “Jurnal Presisi” validation feedback is clear.
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
   - 11 demo users covering all roles + multi-role examples
   - 7 classes, 8 rooms (GPS), 14 subjects
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
   - Staff dashboard (for tendik/piket/bk/tatib/ekstra as landing)
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

### Phase 3 — Stabilization + Dynamic QR hardening + deeper role UX
**Goal:** extend functionality and harden production operations.

🔜 Planned enhancements:
1. Dynamic QR hardening:
   - per-room secret rotation UI
   - tighter validation windows + replay prevention
2. Journals:
   - editing rules, backend lock enforcement UI indicator
   - better attendance entry UX (per-student optional)
3. Scheduling:
   - conflict detection
   - import (CSV/Excel)
   - approval workflow
4. Observability:
   - log filtering + export
   - performance metrics
5. Permission hardening:
   - fine-grained permissions matrix per role
   - multi-role edge cases and auditing
6. Public monitoring:
   - optional websocket/SSE for realtime instead of polling

**Phase 3 user stories:**
1. As admin, I can enable dynamic QR and teachers can journal without downtime.
2. As teacher, I cannot edit a journal once locked.
3. As wali kelas, I can see per-period teacher compliance.
4. As admin, I can review security logs for attacks and lockouts.
5. As admin, I can detect schedule conflicts before publishing.

**End of Phase 3:** 1 full E2E regression pass.

---

## 3. Next Actions (Immediate)
1. **Handover checklist:**
   - finalize credentials list, demo data guide, environment vars
   - write admin SOP: create user, create room + GPS, create schedule, generate QR card, use monitoring
2. **Branding finalization:**
   - upload official MTsN 2 Kota Malang logo (fallback currently can use Kemenag)
3. **GPS operational setup:**
   - input GPS lat/lon for each room/class from onsite measurement
   - set radius per room (recommend 20–50m based on accuracy)
   - decide which rooms enable GPS enforcement
4. **Dynamic QR rollout plan:**
   - start as “optional mode” per room
   - pilot in selected rooms
5. **Production readiness:**
   - backup/restore strategy for MongoDB
   - configure CORS, JWT_SECRET, QR_MASTER_SECRET

---

## 4. Success Criteria
- ✅ **POC:** all validations pass/fail correctly with clear reasons; B5 overlay export renders correctly.
- ✅ **V1:**
  - Multi-role login + role switching works.
  - Teacher journal only created via validated QR + schedule + optional GPS.
  - Public monitoring accurately reflects schedule and filled status.
  - Admin can manage master data, generate QR cards with template, view logs, and change branding.
- 🔜 **Operational quality:**
  - repeatable demo (active-now schedule available)
  - admin guide + SOP available
  - 1 full regression test run with no critical breaks
