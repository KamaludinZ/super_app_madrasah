# Product Requirements Document (PRD)
# Super Apps MATSANDATAMA - Educational Management System

## 1. Product Overview

### 1.1 Product Name
**Super Apps MATSANDATAMA** - Integrated Educational Management System for MTsN 2 Kota Malang

### 1.2 Product Vision
A comprehensive school administration platform that modernizes educational operations through QR-based attendance tracking, comprehensive student data management, automated scheduling, and real-time reporting for Islamic Junior High Schools.

### 1.3 Target Users
- **School Administrators** (Kepala Sekolah, Admin)
- **Teaching Staff** (Guru, Wali Kelas, Guru BK, Guru Tata Tertib)
- **Students** (Siswa)
- **Parents/Guardians** (Wali Murid)
- **Administrative Staff** (Tenaga Kependidikan)
- **Alumni**

## 2. Core Features & Requirements

### 2.1 Authentication & Authorization System

#### 2.1.1 User Login
- **Username/password authentication** with JWT tokens
- **Math CAPTCHA** on login page to prevent brute force attacks
- **Account lockout** after 5 failed login attempts
- **Session management:**
  - 12-hour maximum session duration (configurable)
  - 30-minute idle timeout (configurable)
  - Automatic logout on idle or session expiration
- **Password policies:**
  - Mandatory password change on first login
  - Password expiration reminder at 6 months (snooze-able)
  - Secure password hashing with bcrypt

#### 2.1.2 Role-Based Access Control (RBAC)
- **32 distinct user roles** including:
  - admin (Full system access)
  - siswa (Student - self-service data access)
  - guru (Teacher - subject teaching, grading)
  - wali_kelas (Homeroom Teacher - class management)
  - kepala_sekolah (Principal - leadership dashboard)
  - guru_piket (Duty Teacher)
  - guru_bk (School Counselor)
  - guru_tata_tertib (Discipline Teacher)
  - And 24 additional specialized roles

#### 2.1.3 Advanced Authentication Features
- **Role switching:** Users with multiple roles can switch context without re-login
- **Admin impersonation:** Administrators can login as other users for troubleshooting
- **Per-user view context:** Override active academic year/semester for individual viewing needs
- **Security event logging:** All authentication events tracked with IP, user agent, timestamp

### 2.2 Journal/Attendance System (Jurnal Presisi)

#### 2.2.1 Core Innovation
Automated teacher attendance tracking using encrypted QR codes with multi-layer real-time validation.

#### 2.2.2 QR Code System
- **Static QR Codes:**
  - Encrypted payload with room metadata
  - Fernet/AES encryption for payload protection
  - Generate B5 format QR cards for printing
  - Batch generation for multiple rooms/teachers

- **Dynamic QR Codes:**
  - TOTP-based (RFC 6238) time-rotation
  - 30-second validity window
  - Room-specific secret keys

#### 2.2.3 Multi-Layer Validation
When teacher scans QR code, system validates:

1. **QR Token Validation:**
   - Decrypt and verify token format
   - Check expiration (for dynamic QR)
   - Verify room metadata

2. **Schedule Validation:**
   - Teacher must be scheduled for that room at scan time
   - Subject assignment verification
   - Day-of-week and time slot matching

3. **GPS Geofence Validation:**
   - Compare user GPS coordinates with room coordinates
   - Configurable radius per room (default: 20 meters)
   - Optional (can be disabled per room)

4. **Grace Period Enforcement:**
   - Configurable grace period before/after scheduled time (default: 15 minutes)
   - Early arrival handling
   - Late arrival flagging

#### 2.2.4 Journal Recording
- **Automatic journal entry creation** upon successful validation
- **Manual journal entry** by admin (with override reason)
- **Journal locking:** Records automatically lock after time window expires
- **Validation details saved:** QR status, schedule status, GPS status with coordinates
- **Journal history:** Full audit trail with timestamps, validation results, notes

### 2.3 Student Management System

#### 2.3.1 EMIS Data Compliance
Comprehensive student data structure with **150+ fields** covering:

**Basic Information:**
- NISN (National Student ID Number)
- NIS (School Student ID)
- NISM (Islamic School Student ID)
- NPU (Exam Participant Number)
- Full name, gender, birth place/date
- Address (multiple levels)
- Photo upload

**Family Data:**
- **Father (Bio):** Name, status, citizenship, education, occupation, income, phone, address
- **Mother (Bio):** Same fields as father
- **Guardian (Wali):** Alternative guardian with complete details
- Sibling count, birth order

**Support Programs:**
- KIP (Kartu Indonesia Pintar) number
- KK (Kartu Keluarga) number
- PKH (Program Keluarga Harapan) status

**Education History:**
- Pre-school attendance (TK/RA/PAUD)
- Vaccinations (Hepatitis B, BCG, DPT, Polio, Campak)

**Document Archiving:**
- Photo, birth certificate, SD diploma, family card (KK), KIP card, PKH documents

#### 2.3.2 Student Operations
- **CRUD operations** for student records
- **Bulk import from Excel** with EMIS field mapping
- **Excel export** for reporting and backup
- **Student search** by NISN, NIS, name, class
- **Photo management** with upload and display

#### 2.3.3 Student Mutations
- **Entry tracking:** New student registration with mutation date and note
- **Exit tracking:** Transfer, dropout with reason and destination school
- **Mutation documentation:** Complete audit trail

#### 2.3.4 Graduation Management
- **Graduation status tracking:**
  - aktif (Active)
  - lulus (Graduated)
  - mutasi_keluar (Transferred out)
  - dropout (Dropout)
- **Graduation date and certificate number**
- **Automatic alumni record creation** upon graduation

### 2.4 Class & Schedule Management

#### 2.4.1 Class Structure
- **Class organization:**
  - Class name and code (e.g., "7A", "8B", "9C")
  - Grade level (7, 8, 9)
  - Homeroom teacher assignment
  - Capacity management
  - Semester binding

- **Class operations:**
  - Create, update, delete classes
  - Assign/reassign homeroom teachers
  - View class student roster
  - Class schedule grid view

#### 2.4.2 Room/Classroom Management
- **Room details:**
  - Room name and code
  - GPS coordinates (latitude, longitude)
  - Geofence radius (configurable, default 20m)
  - GPS enable/disable toggle
  - QR secret for dynamic QR validation

- **QR card generation:**
  - B5 format customizable template
  - Room name, code, QR code displayed
  - Batch generation for multiple rooms
  - Print-ready PDF output

#### 2.4.3 Schedule Management
- **Teaching schedule system:**
  - Teacher-to-room assignments per semester
  - Subject assignment
  - Day-of-week scheduling (Monday-Friday default)
  - Teaching slot management:
    - 9 teaching slots (Jam ke-1 through Jam ke-9)
    - 2 breaks/prayer times
    - Configurable start/end times

- **Schedule operations:**
  - Create individual schedules
  - Bulk import from Excel
  - Update and delete schedules
  - Schedule conflict detection
  - Schedule grid visualization (teacher view, room view, class view)

- **Real-time validation:**
  - During QR scan, verify teacher is scheduled for that room/time
  - Grace period enforcement
  - Multi-day weekly schedule view

### 2.5 Hierarchical Time Management

#### 2.5.1 Three-Level Time Hierarchy

**Level 1: Calendar Year (Tahun Takwim)**
- Annual calendar year (January 1 - December 31)
- Example: 2026 (Jan 1, 2026 - Dec 31, 2026)
- Operations: Create, update, delete, activate

**Level 2: Academic Year (Tahun Pelajaran)**
- School year spanning ~12 months (typically July - June)
- Belongs to a Calendar Year
- Example: 2025/2026 (Jul 1, 2025 - Jun 30, 2026)
- Operations: Create, update, delete, activate

**Level 3: Semester**
- Evaluation period within Academic Year
- Two types:
  - **Ganjil (Odd):** Typically July-December
  - **Genap (Even):** Typically January-June
- Belongs to an Academic Year
- Operations: Create, update, delete, activate

#### 2.5.2 Context Switching
- **Active context:** System-wide active academic year and semester
- **User view context override:** Individual users can view different academic year/semester data
- **Automatic validation:** Prevent operations on inactive periods
- **Historical data access:** View past academic years and semesters

### 2.6 Grading & Report Card System

#### 2.6.1 Grade Input
- **Grade components:**
  - Nilai Harian (Daily grades)
  - Nilai UTS (Mid-term exam)
  - Nilai UAS (Final exam)
  - Nilai Akhir (Final grade - calculated or manual)

- **Grade operations:**
  - Teacher input for assigned subjects
  - Update and delete grades
  - Grade validation (numeric range)
  - Bulk grade import from Excel

#### 2.6.2 Report Card (Rapor) Generation
- **Report card data:**
  - Student info with photo
  - All subject grades for semester
  - GPA calculation
  - Class rank
  - Attendance summary
  - Conduct notes

- **Report card operations:**
  - PDF generation
  - Print-ready format
  - Bulk generation for entire class
  - Export to Excel

### 2.7 Student Attendance Tracking

#### 2.7.1 Daily Attendance
- **Attendance status:**
  - Hadir (Present)
  - Sakit (Sick)
  - Izin (Excused)
  - Alfa (Absent without excuse)

- **Attendance operations:**
  - Daily attendance recording by homeroom teacher
  - Bulk submission for entire class
  - Individual student attendance history
  - Monthly/semester attendance reports
  - Attendance statistics (presence %, absence %)

#### 2.7.2 Cleanliness Tracking
- **Cleanliness status:**
  - Baik (Good)
  - Cukup (Fair)
  - Kurang (Poor)

- **Cleanliness operations:**
  - Daily cleanliness recording by homeroom teacher
  - Group assignment (cleaning rotation)
  - Bulk submission for class
  - Cleanliness history and reports

### 2.8 Discipline/Conduct Management (Tata Tertib)

#### 2.8.1 Discipline Categories
- **Category management:**
  - Category name and code
  - Type classification (conduct type)
  - Severity level (ringan, sedang, berat)
  - Active/inactive status

#### 2.8.2 Infraction Recording
- **Conduct record:**
  - Student ID
  - Category/type
  - Date of infraction
  - Description
  - Severity
  - Witness/reporter
  - Evidence/photos

#### 2.8.3 Handling & Resolution
- **Handling tracking:**
  - Handling type (warning, counseling, parent notification, suspension)
  - Handling date
  - Handler (teacher/counselor)
  - Handling notes
  - Resolved status
  - Follow-up required

- **Parent notification:**
  - Automatic notification generation
  - Parent acknowledgment tracking

### 2.9 Data Verification System (Verval)

#### 2.9.1 Verification Workflow
- **Verification types:**
  - Student data verification
  - Teacher/staff data verification

- **Workflow states:**
  - Pending (awaiting verification)
  - Approved (verified correct)
  - Rejected (corrections needed)

#### 2.9.2 Verification Operations
- **Request verification:**
  - Specify data to verify
  - Attach supporting documents
  - Add verification notes

- **Approve/reject:**
  - Review verification request
  - Approve with notes
  - Reject with reason and required corrections

- **Bulk verification:**
  - Import verification requests from Excel
  - Batch approval for multiple records

### 2.10 Admin Features & System Configuration

#### 2.10.1 School Settings
- **Branding:**
  - School name
  - Logo URL
  - Favicon URL

- **Session configuration:**
  - Maximum session duration (hours)
  - Idle timeout (minutes)

- **Journal/attendance settings:**
  - Grace period (minutes)
  - GPS default enabled/disabled
  - GPS default radius (meters)

- **Email/SMTP settings:**
  - SMTP server, port
  - SMTP username, password
  - From email address

- **System settings:**
  - Maintenance mode toggle
  - Maintenance message
  - CORS allowed origins

#### 2.10.2 User Management
- **User operations:**
  - Create, update, delete users
  - Bulk import from Excel
  - Export users to Excel
  - Search users by name, username, role

- **Role management:**
  - Assign/revoke roles
  - View user's role list
  - Set default active role

#### 2.10.3 Audit & Security Logging
- **Audit logs:**
  - Track all CRUD operations
  - User ID, action, entity type, entity ID
  - Timestamp, IP address, user agent
  - Searchable by entity, user, date range

- **Security logs:**
  - Login attempts (success/failure)
  - Impersonation events
  - Role switches
  - Password changes
  - Session timeouts

#### 2.10.4 Backup & Restore
- **Database backup:**
  - Full database export
  - Scheduled backups
  - Backup download

- **Database restore:**
  - Upload backup file
  - Restore database from backup
  - Restore confirmation with warning

#### 2.10.5 Dashboard Statistics
- **Admin dashboard:**
  - Total users by role
  - Total students, classes
  - Today's journal entries
  - Pending verifications
  - Recent activity

- **Student statistics:**
  - Students by grade
  - Students by class
  - Graduation status breakdown
  - Mutation summary

### 2.11 Role-Specific Dashboards

#### 2.11.1 Admin Dashboard
- System statistics overview
- User management quick access
- Recent audit logs
- System health monitoring
- Settings management

#### 2.11.2 Student Dashboard
- My schedule (today's classes)
- My grades (all subjects, current semester)
- My attendance summary
- My conduct records
- Upcoming exams/tasks

#### 2.11.3 Teacher Dashboard (Guru)
- My teaching schedule (weekly view)
- My journal history
- My grading classes (subjects I teach)
- Grade input quick access
- Student list by class

#### 2.11.4 Homeroom Teacher Dashboard (Wali Kelas)
- My class students roster
- Class attendance summary
- Class cleanliness tracking
- Class grades overview
- Class conduct summary
- Bulk attendance/cleanliness submission

#### 2.11.5 Principal Dashboard (Kepala Sekolah)
- School-wide statistics
- Teacher attendance summary (journal stats)
- Student attendance overview
- Academic performance metrics
- Discipline trends
- Reports access

#### 2.11.6 Counselor Dashboard (Guru BK)
- Students requiring counseling
- Conduct records summary
- Alumni tracking
- Student mutation tracking
- Counseling session logs

### 2.12 Additional Features

#### 2.12.1 Student Promotion/Grade Advancement
- **Promotion operations:**
  - Preview promotion results (students advancing from Grade 7→8, 8→9)
  - Execute batch promotions
  - Handle repeating students
  - Generate new class rosters for next academic year
  - Promotion history tracking

#### 2.12.2 Alumni Management
- **Alumni tracking:**
  - Automatic alumni record creation on graduation
  - Alumni database with graduation date, certificate number
  - Alumni statistics
  - Alumni achievement tracking
  - Alumni contact updates

#### 2.12.3 Extracurricular Activities
- **Activity management:**
  - Activity name, coordinator
  - Member registration
  - Attendance tracking
  - Achievement recording
  - Activity reports

#### 2.12.4 Learning Indicators (Indikator Materi)
- **Indicator management:**
  - Create learning indicators by subject
  - Map indicators to curriculum
  - Teacher input indicator results per student
  - Indicator achievement reports

#### 2.12.5 Job Positions (Jabatan)
- **Position management:**
  - Position name and code
  - Position responsibilities
  - Assign positions to staff
  - Position hierarchy

#### 2.12.6 Holidays & Tasks
- **Holiday management:**
  - School holiday calendar
  - Holiday date, name, description
  - Holiday types (national, school event, etc.)

- **Duty tasks:**
  - Duty roster for guru piket
  - Task assignment
  - Task completion tracking
  - Task notes

#### 2.12.7 Student Documents
- **Document management:**
  - Upload student documents (birth cert, diplomas, photos, etc.)
  - Document categorization
  - Document viewing and download
  - Document deletion

#### 2.12.8 Notifications System
- **Announcement creation:**
  - Role-based targeting
  - Title, message, priority
  - Expiration date

- **Notification delivery:**
  - In-app notification bell
  - Notification read/unread status
  - Notification history
  - Notification preferences

#### 2.12.9 Public Monitoring Pages
- **Public dashboard (no auth required):**
  - School monitoring statistics
  - Student achievement highlights
  - School events calendar
  - Public announcements

## 3. Technical Requirements

### 3.1 Technology Stack
- **Frontend:** React 19.0.0, Tailwind CSS, Radix UI, React Router 7.5.1
- **Backend:** FastAPI 0.110.1, Python 3.10+
- **Database:** MongoDB (Motor 3.3.1 async driver)
- **Authentication:** JWT (PyJWT 2.10.1), Bcrypt password hashing
- **QR Generation:** QRCode 8.2, Fernet encryption, Pyotp (TOTP)
- **File Processing:** XLSX (Excel import/export), Pandas, Pillow
- **Server:** Uvicorn 0.25.0 (ASGI)

### 3.2 API Structure
- **Base URL:** `/api`
- **API Documentation:** `/docs` (Swagger UI)
- **Authentication:** Bearer token in Authorization header
- **Response format:** JSON
- **Error handling:** Standardized error responses with status codes

### 3.3 Performance Requirements
- **Response time:** <500ms for standard queries
- **Bulk operations:** Handle 1000+ records import
- **Concurrent users:** Support 200+ simultaneous users
- **Database queries:** Optimized indexes on frequently queried fields
- **Session management:** Efficient JWT validation

### 3.4 Security Requirements
- **Authentication:** JWT tokens with expiration
- **Password security:** Bcrypt hashing, strong password policy
- **RBAC enforcement:** All endpoints protected by role checks
- **Data encryption:** QR payloads encrypted, sensitive data protected
- **Audit logging:** All actions logged with user, timestamp, IP
- **CORS:** Configurable allowed origins
- **Input validation:** Pydantic models for all API inputs
- **SQL injection prevention:** MongoDB with parameterized queries
- **XSS prevention:** Frontend input sanitization

### 3.5 Deployment Requirements
- **Environment:** Docker containerization
- **CI/CD:** GitHub Actions workflow
- **Environment variables:** `.env` files for configuration
- **Database:** MongoDB Atlas or self-hosted
- **Static files:** Served via CDN or reverse proxy
- **Logging:** Structured logging for debugging and monitoring

## 4. User Workflows

### 4.1 Teacher Journal Entry Workflow
1. Teacher opens app and navigates to Journal/Scan page
2. Teacher scans QR code in classroom using camera
3. System decrypts QR and validates:
   - QR token validity
   - Teacher scheduled for this room/time
   - GPS coordinates within geofence (if enabled)
   - Time within grace period
4. If all validations pass:
   - System creates journal entry with timestamp
   - Teacher sees success message with validation details
5. If any validation fails:
   - System shows error with reason (not scheduled, wrong time, GPS out of range)
   - Teacher can request manual entry from admin if needed

### 4.2 Homeroom Teacher Bulk Attendance Workflow
1. Homeroom teacher selects "Kehadiran" (Attendance)
2. System displays list of students in homeroom class
3. Teacher selects date for attendance
4. For each student, teacher marks: Hadir/Sakit/Izin/Alfa
5. Teacher adds optional notes for absent students
6. Teacher clicks "Submit" to save bulk attendance
7. System validates and saves attendance records
8. Teacher sees confirmation and attendance summary

### 4.3 Student Grade Entry Workflow
1. Teacher navigates to "Input Nilai" (Grade Input)
2. System displays subjects teacher is assigned to
3. Teacher selects subject and class
4. System displays student list for that class
5. For each student, teacher enters:
   - Nilai Harian (Daily)
   - Nilai UTS (Mid-term)
   - Nilai UAS (Final)
6. System calculates Nilai Akhir (if formula configured)
7. Teacher reviews and submits grades
8. System validates grade ranges and saves

### 4.4 Admin User Creation Workflow
1. Admin navigates to "Pengguna" (Users)
2. Admin clicks "Tambah Pengguna" (Add User)
3. Admin fills form:
   - Username, password, full name, email, phone
   - Select roles (multiple allowed)
   - Set default active role
   - If student: enter NISN, NIS, class
   - If teacher: enter NIP/NUPTK
4. Admin submits form
5. System validates unique username
6. System creates user and logs action to audit trail
7. Admin sees new user in list

### 4.5 Student Promotion Workflow (End of Year)
1. Admin navigates to "Promosi" (Promotions)
2. Admin selects source academic year and target academic year
3. Admin clicks "Preview Promosi"
4. System calculates:
   - Grade 7 students → Grade 8
   - Grade 8 students → Grade 9
   - Grade 9 students → Graduated/Alumni
5. Admin reviews preview (student count per grade, class assignments)
6. Admin clicks "Eksekusi Promosi"
7. System:
   - Updates student grades
   - Creates new class rosters for next year
   - Marks Grade 9 students as graduated
   - Creates alumni records for graduates
   - Logs all changes to audit trail
8. Admin sees promotion summary and confirmation

## 5. Success Metrics

### 5.1 System Adoption
- **Target:** 95% of teachers using journal/QR system daily
- **Target:** 100% of students registered with EMIS data
- **Target:** 90% of grades entered within 1 week of assessment

### 5.2 Operational Efficiency
- **Reduce manual attendance tracking time by 70%**
- **Reduce report card generation time from 3 days to 1 hour**
- **Eliminate paper-based journal logs**

### 5.3 Data Quality
- **Target:** 100% EMIS compliance for student data
- **Target:** Zero data discrepancies in audit logs
- **Target:** 99.9% uptime for system availability

### 5.4 User Satisfaction
- **Target:** 4.5/5 user satisfaction rating from teachers
- **Target:** <5 support tickets per week
- **Target:** 90% of users trained within first month

## 6. Constraints & Assumptions

### 6.1 Constraints
- **Internet connectivity required** for QR validation and real-time features
- **GPS accuracy** depends on device capabilities (may vary by phone model)
- **Browser compatibility:** Modern browsers only (Chrome, Edge, Safari latest versions)
- **Mobile responsive:** Must work on tablets and smartphones

### 6.2 Assumptions
- **All teachers have smartphones** with camera and GPS
- **School has stable internet connection** in classrooms
- **Classrooms have fixed GPS coordinates** (not mobile)
- **Academic calendar follows standard Jul-Jun cycle**
- **Users have basic digital literacy** for system usage

## 7. Future Enhancements (Out of Scope for Initial Release)

- **Parent mobile app** for viewing student progress
- **SMS notifications** for attendance and grade updates
- **Integration with national EMIS system** (automatic sync)
- **AI-based conduct prediction** (identify at-risk students)
- **Advanced analytics dashboard** with charts and trends
- **E-learning module** for online classes
- **Library management** system integration
- **School finance module** (fee payment, expenses)

## 8. Glossary

| Term | Definition |
|------|------------|
| EMIS | Education Management Information System (national student data standard) |
| NISN | Nomor Induk Siswa Nasional (National Student ID Number) |
| NIS | Nomor Induk Siswa (School Student ID) |
| NISM | Nomor Induk Siswa Madrasah (Islamic School Student ID) |
| NPU | Nomor Peserta Ujian (Exam Participant Number) |
| Jurnal Presisi | Precision Journal (automated teacher attendance system) |
| QR | Quick Response code (2D barcode) |
| TOTP | Time-based One-Time Password (RFC 6238) |
| JWT | JSON Web Token (authentication token standard) |
| Guru | Teacher |
| Wali Kelas | Homeroom Teacher |
| Siswa | Student |
| Kepala Sekolah | Principal |
| Tata Tertib | Discipline/Conduct rules |
| Rapor | Report Card |
| Tahun Takwim | Calendar Year (Jan-Dec) |
| Tahun Pelajaran | Academic Year (Jul-Jun) |
| Semester Ganjil | Odd Semester (Jul-Dec) |
| Semester Genap | Even Semester (Jan-Jun) |
| KIP | Kartu Indonesia Pintar (Indonesia Smart Card - financial aid) |
| KK | Kartu Keluarga (Family Card) |
| PKH | Program Keluarga Harapan (Family Hope Program - social assistance) |
