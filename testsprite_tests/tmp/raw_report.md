
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** super_app_madrasah
- **Date:** 2026-05-25
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Log in and reach the current user profile
- **Test Code:** [TC001_Log_in_and_reach_the_current_user_profile.py](./TC001_Log_in_and_reach_the_current_user_profile.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/7e11ebed-3921-498c-9d15-54aee62fa1ac
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Validate an assigned QR and create a journal entry
- **Test Code:** [TC002_Validate_an_assigned_QR_and_create_a_journal_entry.py](./TC002_Validate_an_assigned_QR_and_create_a_journal_entry.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the UI does not allow saving a new agenda, so subsequent QR attendance and journal steps cannot be performed.

Observations:
- After clicking 'Simpan', a notification appeared: 'Fitur simpan agenda sedang dalam pengembangan'.
- The Agenda Guru page still shows 'Belum ada agenda. Klik "Tambah Agenda" untuk membuat agenda baru.'

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/ea45ef10-0937-4776-995e-8c41258a22a2
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Lock an account after repeated failed sign-ins
- **Test Code:** [TC003_Lock_an_account_after_repeated_failed_sign_ins.py](./TC003_Lock_an_account_after_repeated_failed_sign_ins.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/00cea865-8622-430e-881f-904f53727259
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Validate a scheduled QR attendance scan
- **Test Code:** [TC004_Validate_a_scheduled_QR_attendance_scan.py](./TC004_Validate_a_scheduled_QR_attendance_scan.py)
- **Test Error:** TEST BLOCKED

The QR attendance validation feature could not be reached — the UI indicates the attendance integration is still under development and no validation controls or entries are available to exercise.

Observations:
- The Laporan Absensi page shows a prominent note: "Integrasi dengan sistem absensi sedang dalam pengembangan." (integration with attendance system is under development).
- The attendance table displays "Memuat data..." and no validation/verification controls or QR validation entries are present.
- Multiple attempts to find a 'validasi' entry on the QR Generator page earlier failed (no validation entry located there either).

Conclusion: The required teacher QR attendance validation flow cannot be executed because the backend/feature appears not implemented or not integrated into the UI. The test is blocked and cannot continue until the attendance integration or the validation UI is available.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/ab717532-eb05-4d06-964e-00c00e2d0485
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Log out and end the session
- **Test Code:** [TC005_Log_out_and_end_the_session.py](./TC005_Log_out_and_end_the_session.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/0995f09c-e09c-44fd-8efb-9844f02e202b
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Block an unscheduled QR attendance attempt
- **Test Code:** [TC006_Block_an_unscheduled_QR_attendance_attempt.py](./TC006_Block_an_unscheduled_QR_attendance_attempt.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/2b82cfc6-a522-46c2-b940-243df84a5adf
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Create a student record with EMIS-compliant data
- **Test Code:** [TC007_Create_a_student_record_with_EMIS_compliant_data.py](./TC007_Create_a_student_record_with_EMIS_compliant_data.py)
- **Test Error:** TEST BLOCKED

The student creation feature could not be reached — no visible UI control to create a new student was found on the Data Siswa page.

Observations:
- The Data Siswa page lists 5 students: Ahmad Faza Pratama; Aisyah Nur Hidayah; Bagus Pratama; Muhammad Rizki Pratama; Najwa Aulia Rahma (visible in the table with per-row actions Detail, Info Akun, Edit).
- No 'Tambah', 'Tambah Siswa', 'Tambah Baru', or similar create button/link was found after enumerating buttons, scrolling the page, and searching the page text for 'Tambah'.
- Only list controls are available (search input, class filter) and per-row actions — there is no discoverable UI path to open a student creation form, so the create-student test cannot be executed.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/b7ba05fe-26d8-4ed3-9a2c-54a11809c133
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Switch to an allowed role and keep the new session role
- **Test Code:** [TC008_Switch_to_an_allowed_role_and_keep_the_new_session_role.py](./TC008_Switch_to_an_allowed_role_and_keep_the_new_session_role.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the user account does not have an alternate role to switch to.

Observations:
- The role dropdown opened and shows 'Administrator' as 'aktif'.
- The UI displays the message 'Anda hanya memiliki 1 peran', indicating no alternate roles are available for selection.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/41ffbc6a-7ad2-42f0-bdac-62ce2f416d5a
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Update school settings successfully
- **Test Code:** [TC009_Update_school_settings_successfully.py](./TC009_Update_school_settings_successfully.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/ac294d9a-cd8b-410c-8800-3d7ffcc5bc2e
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Create a teaching schedule entry
- **Test Code:** [TC010_Create_a_teaching_schedule_entry.py](./TC010_Create_a_teaching_schedule_entry.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/fd6aaba5-be4d-47bb-ae00-0375ea3555f1
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Record grades for a class
- **Test Code:** [TC011_Record_grades_for_a_class.py](./TC011_Record_grades_for_a_class.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/e9f4864c-82a7-45cb-b7cd-4a552b67c7df
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 View admin system statistics
- **Test Code:** [TC012_View_admin_system_statistics.py](./TC012_View_admin_system_statistics.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/caabe616-8943-451c-b3ae-5a1de0386138
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Update an existing student record
- **Test Code:** [TC013_Update_an_existing_student_record.py](./TC013_Update_an_existing_student_record.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/246c81de-5d9a-4ec8-b7fe-36bed9390792
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 View the current academic context
- **Test Code:** [TC014_View_the_current_academic_context.py](./TC014_View_the_current_academic_context.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/21adadf7-2e04-435d-91e6-57ac6a78e981
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 View assigned teaching classes and subjects
- **Test Code:** [TC015_View_assigned_teaching_classes_and_subjects.py](./TC015_View_assigned_teaching_classes_and_subjects.py)
- **Test Error:** TEST BLOCKED

The test could not be run — there is no way to switch or logout from the current Administrator session to attempt a teacher login.

Observations:
- The account role menu shows only "Administrator" and the message indicating "Anda hanya memiliki 1 peran"; no logout or switch-user option is present.
- Attempts to navigate to /login while logged in did not load the login form (the SPA remained on the dashboard), preventing a direct teacher login.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/9fa4129d-7867-48f4-b330-d8d6b073e726
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC016 Review personal journal history
- **Test Code:** [TC016_Review_personal_journal_history.py](./TC016_Review_personal_journal_history.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/b62914fa-adaf-4569-a91d-9843593c1a77
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 Create a class record
- **Test Code:** [TC017_Create_a_class_record.py](./TC017_Create_a_class_record.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/6170b1b7-ca2e-4e10-9c40-0fcd1c9f0ff3
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC018 Switch to a different semester context
- **Test Code:** [TC018_Switch_to_a_different_semester_context.py](./TC018_Switch_to_a_different_semester_context.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/0ab251ff-5aff-4c75-b60d-ce911b2ab4d8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019 Review the audit log trail
- **Test Code:** [TC019_Review_the_audit_log_trail.py](./TC019_Review_the_audit_log_trail.py)
- **Test Error:** TEST FAILURE

Searchable audit log feature is not available — no search input or control was found on the Audit Trail panel.

Observations:
- The Audit Trail table is displayed with many entries visible (multiple <tr> rows present).
- No search input or [role=search] element was found via DOM queries (search for input[type=search], input[placeholder], input[aria-label], [role=search] returned 0 matches).
- No visible search control or filter UI is present within the Audit Trail tab in the page screenshot or interactive elements.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/f528cb60-3441-4a81-aa5a-be4619238a4e
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020 Open a student grade summary
- **Test Code:** [TC020_Open_a_student_grade_summary.py](./TC020_Open_a_student_grade_summary.py)
- **Test Error:** TEST FAILURE

The E-Rapor (student grade summary) page is reachable and the target student (Ahmad Faza Pratama, NISN 0098765101) can be selected, but final numeric/final scores are not displayed for the selected semester.

Observations:
- The E-Rapor view and student header are visible (Nama Siswa, NISN, Kelas, Tahun Pelajaran, Semester).
- The report table headers including 'Nilai Akhir' are present, but the content shows the message: 'Belum ada nilai untuk semester ini' and 'Guru mata pelajaran belum menginput nilai.'
- No final scores or numeric 'Nilai Akhir' values are visible in the report for this student/semester.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/0d7c90fd-41b7-437d-8a2c-056bbc55e6ad
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC021 Reject an incomplete student record
- **Test Code:** [TC021_Reject_an_incomplete_student_record.py](./TC021_Reject_an_incomplete_student_record.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the UI does not provide a visible way to create a new student record from the Data Siswa page, so the required scenario (leaving a required identifier empty and verifying validation) cannot be executed.

Observations:
- The Data Siswa page displays a student list with per-row actions (Detail, Info Akun, Edit) but no global 'Tambah' / 'Tambah Siswa' / 'Tambah Data' button was found.
- Page searches for 'Tambah', 'Tambah Siswa', and 'Tambah Data' returned 0 matches; 31 buttons were enumerated without a create/add control.
- The visible UI contains filters and a search box but no control to start creating a new student record.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/a2a37abf-0010-44f9-bd2d-270e8ae31d03
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC022 Open the weekly schedule grid
- **Test Code:** [TC022_Open_the_weekly_schedule_grid.py](./TC022_Open_the_weekly_schedule_grid.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/df0b4d67-2ccc-4f74-a97f-06e3b6628eaf
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC023 Submit bulk attendance for a class
- **Test Code:** [TC023_Submit_bulk_attendance_for_a_class.py](./TC023_Submit_bulk_attendance_for_a_class.py)
- **Test Error:** TEST BLOCKED

The test could not be run — no students are available in the selected classes, so attendance cannot be recorded.

Observations:
- The attendance UI loads and the date is set to 2026-05-24, but the student list shows "Daftar Siswa (0)".
- Classes 7A, 7B, and 7C were selected and each shows 0 students in the list.
- Without any students in the class, bulk attendance entries cannot be created or submitted, so the attendance summary cannot be produced or verified.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/f4c7f1be-283d-4835-b067-fe49d8825893
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC024 Create a discipline category
- **Test Code:** [TC024_Create_a_discipline_category.py](./TC024_Create_a_discipline_category.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/00cf841e-ee6c-4fcd-975e-b0fa57235ef8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC025 Create a system backup
- **Test Code:** [TC025_Create_a_system_backup.py](./TC025_Create_a_system_backup.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/e55a0cef-9fb8-4c74-8cf4-b53ae4ebd766
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC026 Block journal creation when QR validation fails
- **Test Code:** [TC026_Block_journal_creation_when_QR_validation_fails.py](./TC026_Block_journal_creation_when_QR_validation_fails.py)
- **Test Error:** TEST BLOCKED

The test could not be run — there are no schedules available to open and submit a QR for validation.

Observations:
- The monitoring page shows 'Tidak ada jadwal' and 'Total Jadwal 0'.
- The Aktif tab displays 0 items and the schedule list area displays the 'Tidak ada jadwal' message.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/e793340f-b71e-41b9-95d8-5f95c64a9234
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC027 Import schedules from a spreadsheet
- **Test Code:** [TC027_Import_schedules_from_a_spreadsheet.py](./TC027_Import_schedules_from_a_spreadsheet.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/313022bb-e14d-4722-8c9d-f750a1e11414
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC028 Approve a pending verification request
- **Test Code:** [TC028_Approve_a_pending_verification_request.py](./TC028_Approve_a_pending_verification_request.py)
- **Test Error:** TEST BLOCKED

The test could not be run — there are no pending verification requests to approve.

Observations:
- The Verval Data Siswa page shows '0 total request • 0 menunggu review'.
- The table body displays a loading placeholder 'Memuat...' and no request rows are present.
- The Refresh button is rendered but is disabled, preventing reloading/request retrieval from the UI.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/87f80739-0d95-43f1-9fdc-293b6789fa51
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC029 View the class list
- **Test Code:** [TC029_View_the_class_list.py](./TC029_View_the_class_list.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/3459c2cf-215c-4eb2-8fd9-787082b0e9ff
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC030 Submit a verification request
- **Test Code:** [TC030_Submit_a_verification_request.py](./TC030_Submit_a_verification_request.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9f745722-e719-4669-b267-34a6888dc592/77d15285-830d-47b9-95bd-b89a3784afc6
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **63.33** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---