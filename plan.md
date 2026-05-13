# plan.md — Super Apps MATSANDATAMA (MVP)

## 1. Objectives
- Prove **core workflow** “Jurnal Presisi” works end-to-end: **QR (encrypted) → decrypt → schedule validation → optional GPS geofence (room-based) → journal create → auto-lock by time**.
- Deliver V1 web app (FastAPI + React + MongoDB) with **9 roles + multi-role switching**, master data, scheduling, QR card generator (B5 template upload), parent dashboard, **public realtime monitoring page**, audit/security logs, and branding settings.
- Ensure stability with incremental E2E testing after each phase.

---

## 2. Implementation Steps

### Phase 1 — POC Core “Jurnal Presisi” (Isolation, must pass before app build)
**Goal:** validate hardest parts without full app complexity.
1. Web research (best practice):
   - Fernet/AES payload design + key rotation basics
   - TOTP QR pattern (RFC 6238) and secure validation window
   - Browser QR scanning options (html5-qrcode) constraints
   - Haversine distance + practical GPS accuracy handling
2. Create `poc_jurnal_presisi.py` (single runnable script):
   - Define in-memory fixtures: rooms (lat/lon, radius), teacher, schedule blocks, settings (gps_enabled, static/dynamic).
   - **Static QR**: generate encrypted payload `{school_id, room_id, issued_at}` via Fernet; render QR image.
   - **Decrypt/validate**: decode QR → validate school_id, room_id, payload TTL (optional).
   - **Schedule validation**: check teacher has class in room at `now` (WIB) with grace window.
   - **GPS validation**: compute distance (Haversine) vs room radius; allow toggle off.
   - **Locking rule**: journal allowed only until lesson end + grace; then locked.
   - Journal entry object creation + validation status summary.
3. Create `poc_b5_card.py`:
   - Upload/choose B5 portrait template (local file) → overlay QR + room/class text → export PNG/PDF-ready image.
4. Create `poc_totp_dynamic_qr.py` (visibility only; not gate for V1):
   - Generate TOTP; encode in QR; validate with time-step window.
5. POC success review: capture outputs (QR images, overlay result, printed validation logs). Fix until all checks pass.

**Phase 1 user stories (POC):**
1. As a developer, I can generate an encrypted static QR for a room and scan/decrypt it to recover the room_id.
2. As a developer, I can reject journal creation if the teacher has no active schedule at the scanned room/time.
3. As a developer, I can toggle GPS validation on/off and see different validation outcomes.
4. As a developer, I can reject journal creation when device location is outside the room radius.
5. As a developer, I can generate a printable B5 card image by overlaying QR on an uploaded template.

---

### Phase 2 — V1 App Development (build around proven core)
**Goal:** working MVP with core feature complete; keep dynamic QR as UI-visible but static is primary.

#### 2.1 Backend (FastAPI)
1. Project skeleton + config:
   - MongoDB connection, timezone WIB, settings collection (branding, gps default, qr mode).
2. Data model/collections + indexes:
   - users (roles[]), rooms (lat/lon/radius), classes, subjects, schedules, journals, academic_years/semesters, parent_student, audit_logs, security_logs, settings, qr_card_templates.
3. Auth (now, because required for role UX):
   - Username+password (bcrypt), JWT, math captcha endpoint, rate-limit + lockout, admin reset password.
4. RBAC + multi-role switching:
   - roles in JWT + “active_role” claim; endpoint to switch role.
5. Master data CRUD (Admin UI-driven):
   - Academic year/semester, classes, rooms (GPS+radius), subjects, users (multi-role), student-class mapping, parent-student mapping.
6. Schedule management:
   - CRUD + optional approval flag; query “what’s active now”.
7. Smart Journal endpoints (use POC logic):
   - QR decrypt/validate, schedule check, GPS check (toggle + per-room radius), create journal, lock journal after end time.
8. QR management:
   - Generate static QR per room, store metadata.
   - Dynamic QR mode flag (exposed) + validation endpoint stub/limited.
   - Template upload (B5 portrait) + overlay render endpoint (Pillow) + download.
9. Public monitoring endpoints (no login):
   - `GET /public/monitoring/now` returns all rooms/classes scheduled now + journal status.
10. Logging:
   - Audit log for CRUD; security log for login attempts, lockouts, role switches.
11. Seed demo data:
   - Create demo accounts for all roles (including multi-role example), base rooms/classes/schedules for realistic monitoring.

#### 2.2 Frontend (React)
1. App shell + theme:
   - Kemenag green theme, default logo Kemenag fallback; mobile-first.
2. Login:
   - username/password + math captcha + lockout messaging.
3. Role switcher:
   - if roles>1 show switch dropdown; update active role.
4. Dashboards (minimal but functional):
   - Admin: quick links + monitoring + logs.
   - Guru: today schedule + “Scan QR → Jurnal Form → Submit” + history.
   - Wali Kelas: status jurnal kelasnya hari ini.
   - Siswa/Ortu: view journal & attendance (read-only MVP).
   - Tendik/Piket/BK/Tatib/Ekstra: landing dashboard + relevant read-only views (expand later).
5. Smart Journal flow:
   - QR scan via device camera (html5-qrcode) → show validation result (schedule, gps, time) → journal form → submit.
6. QR card generator:
   - Admin selects room → generate QR → upload B5 template → preview overlay → download.
7. Public realtime monitoring page:
   - Public route shows active schedule + journal status; polling every N seconds; filters.
8. Admin settings:
   - Branding upload, GPS toggle default, QR mode toggle (static primary), academic year active.

**Phase 2 user stories (V1):**
1. As an admin, I can create a user with multiple roles and the user can switch roles after login.
2. As an admin, I can set GPS center+radius per room and toggle GPS enforcement on/off.
3. As a teacher, I can scan a room QR and only open the journal form if schedule+GPS+time validations pass.
4. As a public visitor, I can view realtime journal completion status for all classes currently scheduled.
5. As an admin, I can upload a B5 portrait template and download QR cards with the template applied.

**End of Phase 2:** run 1 full E2E pass (login→CRUD minimal→scan→create journal→public monitoring reflects status).

---

### Phase 3 — Stabilization + Dynamic QR hardening + deeper role UX
1. Dynamic QR (TOTP) full support:
   - per-room secret (rotatable), server validation window, fallback to static mode.
2. Journals:
   - editing rules, auto-lock enforcement on backend, better attendance entry UX.
3. Scheduling:
   - import template (CSV/Excel later), conflict detection, approval workflow UI.
4. Observability:
   - admin views for audit/security logs with filters/export.
5. Permission hardening:
   - fine-grained permissions per role, multi-role edge cases.

**Phase 3 user stories:**
1. As an admin, I can enable dynamic QR and teachers can still journal without downtime.
2. As a teacher, I cannot edit a journal once the lesson is locked.
3. As a wali kelas, I can see per-period which teacher has not filled journal yet.
4. As an admin, I can review security logs for failed logins and locked accounts.
5. As an admin, I can detect schedule conflicts before publishing.

**End of Phase 3:** run 1 full E2E regression pass.

---

## 3. Next Actions (Immediate)
1. Confirm fixed identifiers to bake into QR payload: `school_id` value and naming conventions for room/class.
2. Decide grace windows (minutes) for: schedule start tolerance, schedule end lock tolerance.
3. Provide/confirm sample room list (at least 3 rooms) + their GPS points (or allow admin set in UI only for V1).
4. Start Phase 1 POC scripts (QR static + decrypt + schedule + GPS + B5 overlay) and iterate until green.

---

## 4. Success Criteria
- **POC:** all validations pass/fail correctly with clear reasons; B5 overlay export renders correctly.
- **V1:**
  - Multi-role login + role switching works.
  - Teacher journal can only be created via validated QR + schedule + optional GPS.
  - Public monitoring page accurately reflects “scheduled now” and journal filled/unfilled within polling interval.
  - Admin can manage master data, generate QR cards with template, view logs, and change branding.
- **Quality:** 1 complete E2E run per phase with no critical breaks.