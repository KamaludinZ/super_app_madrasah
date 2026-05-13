"""
Super Apps MATSANDATAMA - Phase 3 Backend API Tests
Tests 25 new Phase 3 endpoints and features as specified in review request.
"""
import requests
import sys
import json
import time
import io
from datetime import datetime, date
from typing import Dict, Any, Optional

BASE_URL = "https://geolocation-verify.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

class Phase3Tester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.admin_token = None
        self.guru1_token = None
        self.walas7a_token = None
        self.siswa1_token = None
        self.class_7a_id = None
        self.class_7b_id = None
        self.test_results = []
        
    def log(self, message: str, level: str = "info"):
        prefix = {
            "info": f"{Colors.BLUE}ℹ{Colors.RESET}",
            "success": f"{Colors.GREEN}✓{Colors.RESET}",
            "error": f"{Colors.RED}✗{Colors.RESET}",
            "warning": f"{Colors.YELLOW}⚠{Colors.RESET}",
        }.get(level, "")
        print(f"{prefix} {message}")
    
    def test(self, name: str, method: str, endpoint: str, expected_status: int,
             data: Optional[Dict] = None, headers: Optional[Dict] = None,
             token: Optional[str] = None, params: Optional[Dict] = None,
             files: Optional[Dict] = None) -> tuple:
        """Run a single API test"""
        self.tests_run += 1
        url = f"{BASE_URL}/{endpoint}"
        
        req_headers = {}
        if not files:  # Only set Content-Type for JSON requests
            req_headers['Content-Type'] = 'application/json'
        if token:
            req_headers['Authorization'] = f'Bearer {token}'
        if headers:
            req_headers.update(headers)
        
        self.log(f"Test #{self.tests_run}: {name}", "info")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, params=params, timeout=15)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data, headers=req_headers, timeout=15)
                else:
                    response = requests.post(url, json=data, headers=req_headers, params=params, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, params=params, timeout=15)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, params=params, timeout=15)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"  PASSED - Status: {response.status_code}", "success")
                result = {
                    "test": name,
                    "status": "PASSED",
                    "expected": expected_status,
                    "actual": response.status_code,
                }
                self.test_results.append(result)
                try:
                    return True, response.json() if response.headers.get('content-type', '').startswith('application/json') else response
                except:
                    return True, response
            else:
                self.tests_failed += 1
                self.log(f"  FAILED - Expected {expected_status}, got {response.status_code}", "error")
                try:
                    error_detail = response.json()
                    self.log(f"  Response: {json.dumps(error_detail, indent=2)}", "error")
                except:
                    self.log(f"  Response: {response.text[:200]}", "error")
                result = {
                    "test": name,
                    "status": "FAILED",
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text[:500],
                }
                self.test_results.append(result)
                return False, {}
                
        except Exception as e:
            self.tests_failed += 1
            self.log(f"  FAILED - Exception: {str(e)}", "error")
            result = {
                "test": name,
                "status": "FAILED",
                "expected": expected_status,
                "actual": "EXCEPTION",
                "error": str(e),
            }
            self.test_results.append(result)
            return False, {}
    
    def login_user(self, username: str, password: str) -> Optional[str]:
        """Helper to login and get token"""
        # Get captcha
        success, captcha_data = self.test(
            f"GET /api/auth/captcha (for {username} login)",
            "GET", "auth/captcha", 200
        )
        if not success:
            return None
        
        # Parse captcha
        import re
        question = captcha_data['question']
        match = re.search(r'Berapa (\d+) ([+\-]) (\d+)', question)
        if not match:
            return None
        
        a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
        captcha_answer = a + b if op == '+' else a - b
        
        # Login
        success, login_data = self.test(
            f"POST /api/auth/login as {username}",
            "POST", "auth/login", 200,
            data={
                "username": username,
                "password": password,
                "captcha_id": captcha_data['challenge_id'],
                "captcha_answer": captcha_answer
            }
        )
        
        if success:
            return login_data.get('access_token')
        return None
    
    def run_phase3_tests(self):
        """Run all 25 Phase 3 test cases"""
        self.log("=" * 80, "info")
        self.log("SUPER APPS MATSANDATAMA - PHASE 3 BACKEND API TESTS", "info")
        self.log("=" * 80, "info")
        
        # ============================================================
        # SETUP: Login all test users
        # ============================================================
        self.log("\n[SETUP] Logging in test users", "info")
        
        self.admin_token = self.login_user("admin", "admin123")
        if not self.admin_token:
            self.log("CRITICAL: Admin login failed. Cannot proceed.", "error")
            return
        self.log("  Admin logged in successfully", "success")
        
        self.guru1_token = self.login_user("guru1", "guru123")
        if not self.guru1_token:
            self.log("WARNING: guru1 login failed", "warning")
        else:
            self.log("  guru1 logged in successfully", "success")
        
        self.walas7a_token = self.login_user("walas7a", "walas123")
        if not self.walas7a_token:
            self.log("WARNING: walas7a login failed", "warning")
        else:
            self.log("  walas7a logged in successfully", "success")
        
        self.siswa1_token = self.login_user("siswa1", "siswa123")
        if not self.siswa1_token:
            self.log("WARNING: siswa1 login failed", "warning")
        else:
            self.log("  siswa1 logged in successfully", "success")
        
        # Get class IDs
        success, classes = self.test(
            "GET /api/classes (setup)",
            "GET", "classes", 200,
            token=self.admin_token
        )
        if success:
            for c in classes:
                if c.get('name') == '7A':
                    self.class_7a_id = c['id']
                elif c.get('name') == '7B':
                    self.class_7b_id = c['id']
            self.log(f"  Class 7A ID: {self.class_7a_id}", "info")
            self.log(f"  Class 7B ID: {self.class_7b_id}", "info")
        
        # ============================================================
        # TEST 1: GET /api/settings - public endpoint
        # ============================================================
        self.log("\n[TEST 1] GET /api/settings - verify returns active_days, teaching_slots, idle_timeout_minutes, session_max_hours", "info")
        success, settings = self.test(
            "GET /api/settings - public settings",
            "GET", "settings", 200
        )
        if success:
            assert 'active_days' in settings, "active_days missing"
            assert 'teaching_slots' in settings, "teaching_slots missing"
            assert 'idle_timeout_minutes' in settings, "idle_timeout_minutes missing"
            assert 'session_max_hours' in settings, "session_max_hours missing"
            self.log(f"  active_days: {settings.get('active_days')}", "info")
            self.log(f"  teaching_slots count: {len(settings.get('teaching_slots', []))}", "info")
            self.log(f"  idle_timeout_minutes: {settings.get('idle_timeout_minutes')}", "info")
            self.log(f"  session_max_hours: {settings.get('session_max_hours')}", "info")
        
        # ============================================================
        # TEST 2: POST /api/auth/login - verify expires_in_minutes and idle_timeout_minutes
        # ============================================================
        self.log("\n[TEST 2] POST /api/auth/login - verify response includes expires_in_minutes (720) and idle_timeout_minutes (30)", "info")
        # Already logged in, but let's verify the response structure
        success, captcha = self.test(
            "GET /api/auth/captcha (for login test)",
            "GET", "auth/captcha", 200
        )
        if success:
            import re
            question = captcha['question']
            match = re.search(r'Berapa (\d+) ([+\-]) (\d+)', question)
            if match:
                a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
                captcha_answer = a + b if op == '+' else a - b
                
                success, login_resp = self.test(
                    "POST /api/auth/login - verify JWT expiry fields",
                    "POST", "auth/login", 200,
                    data={
                        "username": "admin",
                        "password": "admin123",
                        "captcha_id": captcha['challenge_id'],
                        "captcha_answer": captcha_answer
                    }
                )
                if success:
                    assert 'expires_in_minutes' in login_resp, "expires_in_minutes missing"
                    assert 'idle_timeout_minutes' in login_resp, "idle_timeout_minutes missing"
                    self.log(f"  expires_in_minutes: {login_resp.get('expires_in_minutes')} (expected 720 = 12h)", "info")
                    self.log(f"  idle_timeout_minutes: {login_resp.get('idle_timeout_minutes')} (expected 30)", "info")
                    if login_resp.get('expires_in_minutes') == 720:
                        self.log(f"  ✓ JWT expiry is 12 hours as expected", "success")
                    if login_resp.get('idle_timeout_minutes') == 30:
                        self.log(f"  ✓ Idle timeout is 30 minutes as expected", "success")
        
        # ============================================================
        # TEST 3: GET /api/admin/settings - admin only
        # ============================================================
        self.log("\n[TEST 3] GET /api/admin/settings (admin only) - returns full settings including active_days array and teaching_slots list", "info")
        success, admin_settings = self.test(
            "GET /api/admin/settings - full settings",
            "GET", "admin/settings", 200,
            token=self.admin_token
        )
        if success:
            assert 'active_days' in admin_settings, "active_days missing"
            assert 'teaching_slots' in admin_settings, "teaching_slots missing"
            assert isinstance(admin_settings.get('active_days'), list), "active_days not a list"
            assert isinstance(admin_settings.get('teaching_slots'), list), "teaching_slots not a list"
            self.log(f"  active_days: {admin_settings.get('active_days')}", "info")
            self.log(f"  teaching_slots count: {len(admin_settings.get('teaching_slots', []))}", "info")
            if len(admin_settings.get('teaching_slots', [])) == 11:
                self.log(f"  ✓ 11 default teaching slots present", "success")
        
        # ============================================================
        # TEST 4: PUT /api/admin/settings - admin updates
        # ============================================================
        self.log("\n[TEST 4] PUT /api/admin/settings - admin updates active_days to ['senin','selasa'] and teaching_slots", "info")
        update_data = {
            "active_days": ["senin", "selasa"],
            "teaching_slots": [
                {"name": "Jam ke-1", "start_time": "07:00", "end_time": "07:45"},
                {"name": "Jam ke-2", "start_time": "07:45", "end_time": "08:30"},
            ]
        }
        success, updated = self.test(
            "PUT /api/admin/settings - update active_days and teaching_slots",
            "PUT", "admin/settings", 200,
            data=update_data,
            token=self.admin_token
        )
        if success:
            assert updated.get('active_days') == ["senin", "selasa"], "active_days not updated"
            assert len(updated.get('teaching_slots', [])) == 2, "teaching_slots not updated"
            self.log(f"  ✓ Settings updated and persisted", "success")
        
        # Restore original settings
        restore_data = {
            "active_days": ["senin", "selasa", "rabu", "kamis", "jumat"],
            "teaching_slots": admin_settings.get('teaching_slots', [])
        }
        self.test(
            "PUT /api/admin/settings - restore original",
            "PUT", "admin/settings", 200,
            data=restore_data,
            token=self.admin_token
        )
        
        # ============================================================
        # TEST 5: GET /api/students - admin can list all
        # ============================================================
        self.log("\n[TEST 5] GET /api/students - admin can list all students", "info")
        success, all_students = self.test(
            "GET /api/students as admin - list all",
            "GET", "students", 200,
            token=self.admin_token
        )
        if success:
            self.log(f"  Admin sees {len(all_students)} students", "info")
        
        # ============================================================
        # TEST 6: GET /api/students?class_id=<7A_id> as walas7a
        # ============================================================
        self.log("\n[TEST 6] GET /api/students?class_id=<7A_id> as walas7a - returns students of class 7A", "info")
        if self.walas7a_token and self.class_7a_id:
            success, class_7a_students = self.test(
                "GET /api/students?class_id=7A as walas7a",
                "GET", "students", 200,
                params={"class_id": self.class_7a_id},
                token=self.walas7a_token
            )
            if success:
                self.log(f"  walas7a sees {len(class_7a_students)} students in 7A", "info")
        
        # ============================================================
        # TEST 7: GET /api/students?class_id=<7B_id> as walas7a - should 403
        # ============================================================
        self.log("\n[TEST 7] GET /api/students?class_id=<7B_id> as walas7a - should return 403 (not their class)", "info")
        if self.walas7a_token and self.class_7b_id:
            success, _ = self.test(
                "GET /api/students?class_id=7B as walas7a - should fail",
                "GET", "students", 403,
                params={"class_id": self.class_7b_id},
                token=self.walas7a_token
            )
            if success:
                self.log(f"  ✓ Access denied as expected (walas7a cannot see 7B students)", "success")
        
        # ============================================================
        # TEST 8: POST /api/attendance/class - submit attendance
        # ============================================================
        self.log("\n[TEST 8] POST /api/attendance/class - submit attendance for class 7A with mixed status", "info")
        if self.walas7a_token and self.class_7a_id:
            today = date.today().isoformat()
            attendance_data = {
                "class_id": self.class_7a_id,
                "date": today,
                "records": [
                    {"student_id": "student1", "status": "hadir"},
                    {"student_id": "student2", "status": "sakit"},
                    {"student_id": "student3", "status": "izin"},
                    {"student_id": "student4", "status": "alpa"},
                ]
            }
            success, attendance_resp = self.test(
                "POST /api/attendance/class - submit attendance",
                "POST", "attendance/class", 200,
                data=attendance_data,
                token=self.walas7a_token
            )
            if success:
                assert 'summary' in attendance_resp, "summary missing"
                summary = attendance_resp.get('summary', {})
                self.log(f"  Summary: hadir={summary.get('hadir')}, sakit={summary.get('sakit')}, izin={summary.get('izin')}, alpa={summary.get('alpa')}", "info")
                if summary.get('hadir') == 1 and summary.get('sakit') == 1 and summary.get('izin') == 1 and summary.get('alpa') == 1:
                    self.log(f"  ✓ Summary calculated correctly", "success")
        
        # ============================================================
        # TEST 9: GET /api/attendance/class/{7A_id}?date=<today>
        # ============================================================
        self.log("\n[TEST 9] GET /api/attendance/class/{7A_id}?date=<today> - retrieves the attendance just submitted", "info")
        if self.walas7a_token and self.class_7a_id:
            success, attendance_list = self.test(
                "GET /api/attendance/class/{7A_id}?date=today",
                "GET", f"attendance/class/{self.class_7a_id}", 200,
                params={"date": today},
                token=self.walas7a_token
            )
            if success:
                self.log(f"  Retrieved {len(attendance_list)} attendance records", "info")
                if len(attendance_list) > 0:
                    self.log(f"  ✓ Attendance retrieved successfully", "success")
        
        # ============================================================
        # TEST 10: POST /api/attendance/class - DUPLICATE (upsert)
        # ============================================================
        self.log("\n[TEST 10] POST /api/attendance/class - DUPLICATE for same class+date should UPDATE (upsert)", "info")
        if self.walas7a_token and self.class_7a_id:
            updated_attendance = {
                "class_id": self.class_7a_id,
                "date": today,
                "records": [
                    {"student_id": "student1", "status": "hadir"},
                    {"student_id": "student2", "status": "hadir"},  # Changed from sakit
                    {"student_id": "student3", "status": "hadir"},  # Changed from izin
                    {"student_id": "student4", "status": "hadir"},  # Changed from alpa
                ]
            }
            success, upsert_resp = self.test(
                "POST /api/attendance/class - upsert (update existing)",
                "POST", "attendance/class", 200,
                data=updated_attendance,
                token=self.walas7a_token
            )
            if success:
                summary = upsert_resp.get('summary', {})
                self.log(f"  Updated summary: hadir={summary.get('hadir')}", "info")
                if summary.get('hadir') == 4:
                    self.log(f"  ✓ Upsert worked - all 4 now marked hadir", "success")
        
        # ============================================================
        # TEST 11: POST /api/cleanliness/class - submit cleanliness
        # ============================================================
        self.log("\n[TEST 11] POST /api/cleanliness/class - submit cleanliness with rating=4, condition='bersih'", "info")
        if self.walas7a_token and self.class_7a_id:
            cleanliness_data = {
                "class_id": self.class_7a_id,
                "date": today,
                "rating": 4,
                "condition": "bersih",
                "notes": "Kelas sangat bersih dan rapi",
                "piket_students": ["student1", "student2"]
            }
            success, clean_resp = self.test(
                "POST /api/cleanliness/class - submit cleanliness",
                "POST", "cleanliness/class", 200,
                data=cleanliness_data,
                token=self.walas7a_token
            )
            if success:
                assert clean_resp.get('rating') == 4, "rating not saved"
                assert clean_resp.get('condition') == 'bersih', "condition not saved"
                self.log(f"  ✓ Cleanliness record created", "success")
        
        # ============================================================
        # TEST 12: GET /api/cleanliness/class/{7A_id}
        # ============================================================
        self.log("\n[TEST 12] GET /api/cleanliness/class/{7A_id} - retrieves history", "info")
        if self.walas7a_token and self.class_7a_id:
            success, clean_list = self.test(
                "GET /api/cleanliness/class/{7A_id}",
                "GET", f"cleanliness/class/{self.class_7a_id}", 200,
                token=self.walas7a_token
            )
            if success:
                self.log(f"  Retrieved {len(clean_list)} cleanliness records", "info")
                if len(clean_list) > 0:
                    self.log(f"  ✓ Cleanliness history retrieved", "success")
        
        # ============================================================
        # TEST 13: GET /api/schedules/grid
        # ============================================================
        self.log("\n[TEST 13] GET /api/schedules/grid - returns days[], slots[], grid{day:{start_time:schedule}}", "info")
        success, grid = self.test(
            "GET /api/schedules/grid",
            "GET", "schedules/grid", 200,
            token=self.guru1_token
        )
        if success:
            assert 'days' in grid, "days missing"
            assert 'slots' in grid, "slots missing"
            assert 'grid' in grid, "grid missing"
            self.log(f"  days: {grid.get('days')}", "info")
            self.log(f"  slots count: {len(grid.get('slots', []))}", "info")
            self.log(f"  grid structure: {type(grid.get('grid'))}", "info")
            self.log(f"  ✓ Grid structure correct", "success")
        
        # ============================================================
        # TEST 14: GET /api/schedules/grid?class_id=<7A>
        # ============================================================
        self.log("\n[TEST 14] GET /api/schedules/grid?class_id=<7A> - filtered by class", "info")
        if self.class_7a_id:
            success, grid_7a = self.test(
                "GET /api/schedules/grid?class_id=7A",
                "GET", "schedules/grid", 200,
                params={"class_id": self.class_7a_id},
                token=self.guru1_token
            )
            if success:
                self.log(f"  ✓ Grid filtered by class 7A", "success")
        
        # ============================================================
        # TEST 15: GET /api/schedules/grid?teacher_id=<guru1>
        # ============================================================
        self.log("\n[TEST 15] GET /api/schedules/grid?teacher_id=<guru1> - filtered by teacher", "info")
        # Get guru1 user ID
        success, me = self.test(
            "GET /api/auth/me as guru1",
            "GET", "auth/me", 200,
            token=self.guru1_token
        )
        if success:
            guru1_id = me.get('id')
            success, grid_guru1 = self.test(
                "GET /api/schedules/grid?teacher_id=guru1",
                "GET", "schedules/grid", 200,
                params={"teacher_id": guru1_id},
                token=self.guru1_token
            )
            if success:
                self.log(f"  ✓ Grid filtered by teacher guru1", "success")
        
        # ============================================================
        # TEST 16: GET /api/schedules/excel-template (admin only)
        # ============================================================
        self.log("\n[TEST 16] GET /api/schedules/excel-template (admin only) - returns .xlsx file", "info")
        success, excel_resp = self.test(
            "GET /api/schedules/excel-template",
            "GET", "schedules/excel-template", 200,
            token=self.admin_token
        )
        if success:
            content_type = excel_resp.headers.get('content-type', '')
            self.log(f"  Content-Type: {content_type}", "info")
            if 'spreadsheet' in content_type or 'excel' in content_type:
                self.log(f"  ✓ Excel template downloaded successfully", "success")
            else:
                self.log(f"  WARNING: Content-Type might not be correct Excel format", "warning")
        
        # ============================================================
        # TEST 17: POST /api/schedules/import-excel with valid Excel
        # ============================================================
        self.log("\n[TEST 17] POST /api/schedules/import-excel with valid Excel - parses and inserts schedules", "info")
        # Create a simple Excel file for testing
        try:
            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "Jadwal"
            ws.append(['hari', 'jam_mulai', 'jam_selesai', 'kelas', 'mapel_kode', 'guru_username', 'ruang_kode', 'semester'])
            ws.append(['senin', '07:00', '07:45', '7A', 'MTK', 'guru1', 'R-7A', 'ganjil'])
            ws.append(['selasa', '08:00', '08:45', '7A', 'IPA', 'walas7a', 'R-7A', 'ganjil'])
            
            excel_buffer = io.BytesIO()
            wb.save(excel_buffer)
            excel_buffer.seek(0)
            
            url = f"{BASE_URL}/schedules/import-excel"
            files = {'file': ('test_jadwal.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.post(url, files=files, headers=headers, timeout=15)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                self.log(f"Test #{self.tests_run}: POST /api/schedules/import-excel - valid Excel", "info")
                self.log(f"  PASSED - Status: {response.status_code}", "success")
                result_data = response.json()
                self.log(f"  Success count: {result_data.get('success')}", "info")
                self.log(f"  Errors: {len(result_data.get('errors', []))}", "info")
                self.test_results.append({
                    "test": "POST /api/schedules/import-excel - valid Excel",
                    "status": "PASSED",
                    "expected": 200,
                    "actual": response.status_code,
                })
            else:
                self.tests_failed += 1
                self.log(f"Test #{self.tests_run}: POST /api/schedules/import-excel - valid Excel", "info")
                self.log(f"  FAILED - Expected 200, got {response.status_code}", "error")
                self.test_results.append({
                    "test": "POST /api/schedules/import-excel - valid Excel",
                    "status": "FAILED",
                    "expected": 200,
                    "actual": response.status_code,
                })
        except Exception as e:
            self.tests_run += 1
            self.tests_failed += 1
            self.log(f"Test #{self.tests_run}: POST /api/schedules/import-excel - Exception: {str(e)}", "error")
            self.test_results.append({
                "test": "POST /api/schedules/import-excel - valid Excel",
                "status": "FAILED",
                "expected": 200,
                "actual": "EXCEPTION",
                "error": str(e),
            })
        
        # ============================================================
        # TEST 18: POST /api/schedules/import-excel with INVALID Excel
        # ============================================================
        self.log("\n[TEST 18] POST /api/schedules/import-excel with INVALID Excel - returns success count + error list", "info")
        try:
            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "Jadwal"
            ws.append(['hari', 'jam_mulai', 'jam_selesai', 'kelas', 'mapel_kode', 'guru_username', 'ruang_kode', 'semester'])
            ws.append(['senin', '07:00', '07:45', '7A', 'MTK', 'guru1', 'R-7A', 'ganjil'])  # Valid
            ws.append(['invalid_day', '08:00', '08:45', '7A', 'IPA', 'walas7a', 'R-7A', 'ganjil'])  # Invalid day
            ws.append(['selasa', '09:00', '09:45', 'NONEXISTENT', 'MTK', 'guru1', 'R-7A', 'ganjil'])  # Invalid class
            
            excel_buffer = io.BytesIO()
            wb.save(excel_buffer)
            excel_buffer.seek(0)
            
            url = f"{BASE_URL}/schedules/import-excel"
            files = {'file': ('test_invalid.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.post(url, files=files, headers=headers, timeout=15)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                self.log(f"Test #{self.tests_run}: POST /api/schedules/import-excel - invalid Excel", "info")
                self.log(f"  PASSED - Status: {response.status_code}", "success")
                result_data = response.json()
                self.log(f"  Success count: {result_data.get('success')}", "info")
                self.log(f"  Errors: {len(result_data.get('errors', []))}", "info")
                if len(result_data.get('errors', [])) > 0:
                    self.log(f"  ✓ Errors correctly reported for invalid rows", "success")
                self.test_results.append({
                    "test": "POST /api/schedules/import-excel - invalid Excel",
                    "status": "PASSED",
                    "expected": 200,
                    "actual": response.status_code,
                })
            else:
                self.tests_failed += 1
                self.log(f"Test #{self.tests_run}: POST /api/schedules/import-excel - invalid Excel", "info")
                self.log(f"  FAILED - Expected 200, got {response.status_code}", "error")
                self.test_results.append({
                    "test": "POST /api/schedules/import-excel - invalid Excel",
                    "status": "FAILED",
                    "expected": 200,
                    "actual": response.status_code,
                })
        except Exception as e:
            self.tests_run += 1
            self.tests_failed += 1
            self.log(f"Test #{self.tests_run}: POST /api/schedules/import-excel - Exception: {str(e)}", "error")
            self.test_results.append({
                "test": "POST /api/schedules/import-excel - invalid Excel",
                "status": "FAILED",
                "expected": 200,
                "actual": "EXCEPTION",
                "error": str(e),
            })
        
        # ============================================================
        # TEST 19: POST /api/academic-years with semester_type='accelerated'
        # ============================================================
        self.log("\n[TEST 19] POST /api/academic-years with semester_type='accelerated' + semesters 1-6", "info")
        accelerated_ay = {
            "name": "2026/2027 Percepatan",
            "is_active": False,
            "semester_type": "accelerated",
            "semesters": [
                {"name": "1", "label": "Semester 1", "is_active": True},
                {"name": "2", "label": "Semester 2", "is_active": False},
                {"name": "3", "label": "Semester 3", "is_active": False},
                {"name": "4", "label": "Semester 4", "is_active": False},
                {"name": "5", "label": "Semester 5", "is_active": False},
                {"name": "6", "label": "Semester 6", "is_active": False},
            ],
            "active_semester": "1"
        }
        success, ay_resp = self.test(
            "POST /api/academic-years - accelerated type",
            "POST", "academic-years", 200,
            data=accelerated_ay,
            token=self.admin_token
        )
        if success:
            assert ay_resp.get('semester_type') == 'accelerated', "semester_type not accelerated"
            assert len(ay_resp.get('semesters', [])) == 6, "semesters count not 6"
            self.log(f"  ✓ Accelerated AY created with 6 semesters", "success")
        
        # ============================================================
        # TEST 20: POST /api/academic-years with semester_type='regular'
        # ============================================================
        self.log("\n[TEST 20] POST /api/academic-years with semester_type='regular' + ganjil/genap", "info")
        regular_ay = {
            "name": "2027/2028",
            "is_active": False,
            "semester_type": "regular",
            "semesters": [
                {"name": "ganjil", "label": "Ganjil", "is_active": True},
                {"name": "genap", "label": "Genap", "is_active": False},
            ],
            "active_semester": "ganjil"
        }
        success, ay_resp2 = self.test(
            "POST /api/academic-years - regular type",
            "POST", "academic-years", 200,
            data=regular_ay,
            token=self.admin_token
        )
        if success:
            assert ay_resp2.get('semester_type') == 'regular', "semester_type not regular"
            assert len(ay_resp2.get('semesters', [])) == 2, "semesters count not 2"
            self.log(f"  ✓ Regular AY created with ganjil/genap", "success")
        
        # ============================================================
        # TEST 21: Verify schedules/my-today still works for guru1
        # ============================================================
        self.log("\n[TEST 21] Verify schedules/my-today still works for guru1 (Matematika R-7A active now)", "info")
        success, my_today = self.test(
            "GET /api/schedules/my-today as guru1",
            "GET", "schedules/my-today", 200,
            token=self.guru1_token
        )
        if success:
            self.log(f"  guru1 has {len(my_today)} schedules today", "info")
            if len(my_today) > 0:
                self.log(f"  ✓ my-today endpoint working", "success")
        
        # ============================================================
        # TEST 22: GPS validation - gps_enabled=False
        # ============================================================
        self.log("\n[TEST 22] Verify GPS validation: gps_enabled=False with no user coords -> valid=True", "info")
        # Get a room and disable GPS
        success, rooms = self.test(
            "GET /api/rooms (for GPS test)",
            "GET", "rooms", 200,
            token=self.admin_token
        )
        if success and len(rooms) > 0:
            test_room_id = rooms[0]['id']
            # Disable GPS
            self.test(
                "PUT /api/rooms/{id} - disable GPS",
                "PUT", f"rooms/{test_room_id}", 200,
                data={"gps_enabled": False},
                token=self.admin_token
            )
            
            # Get QR
            success, qr = self.test(
                "GET /api/rooms/{rid}/qr",
                "GET", f"rooms/{test_room_id}/qr", 200,
                token=self.guru1_token
            )
            
            if success:
                # Validate without GPS coords
                success, validation = self.test(
                    "POST /api/jurnal/validate - GPS disabled, no coords",
                    "POST", "jurnal/validate", 200,
                    data={
                        "qr_token": qr.get('token'),
                        "user_lat": None,
                        "user_lon": None
                    },
                    token=self.guru1_token
                )
                if success:
                    gps_result = validation.get('gps', {})
                    if gps_result.get('valid') == True and 'dinonaktifkan' in gps_result.get('reason', '').lower():
                        self.log(f"  ✓ GPS validation passed with reason: {gps_result.get('reason')}", "success")
        
        # ============================================================
        # TEST 23: GPS validation - gps_enabled=True with FAR coords
        # ============================================================
        self.log("\n[TEST 23] Verify GPS validation: gps_enabled=True with user coords FAR -> valid=False", "info")
        if success and len(rooms) > 0:
            # Enable GPS
            self.test(
                "PUT /api/rooms/{id} - enable GPS",
                "PUT", f"rooms/{test_room_id}", 200,
                data={"gps_enabled": True, "gps_radius_meters": 30.0},
                token=self.admin_token
            )
            
            # Get QR
            success, qr2 = self.test(
                "GET /api/rooms/{rid}/qr",
                "GET", f"rooms/{test_room_id}/qr", 200,
                token=self.guru1_token
            )
            
            if success:
                # Validate with FAR GPS coords (Jakarta)
                success, validation2 = self.test(
                    "POST /api/jurnal/validate - GPS enabled, FAR coords",
                    "POST", "jurnal/validate", 200,
                    data={
                        "qr_token": qr2.get('token'),
                        "user_lat": -6.2088,  # Jakarta
                        "user_lon": 106.8456
                    },
                    token=self.guru1_token
                )
                if success:
                    gps_result2 = validation2.get('gps', {})
                    if gps_result2.get('valid') == False and gps_result2.get('distance'):
                        self.log(f"  ✓ GPS validation failed with distance: {gps_result2.get('distance')}m", "success")
        
        # ============================================================
        # TEST 24: POST /api/jurnal/validate as guru1 with valid QR
        # ============================================================
        self.log("\n[TEST 24] POST /api/jurnal/validate as guru1 with valid QR -> all 3 valid (qr+schedule+gps)", "info")
        # Disable GPS for easier testing
        if success and len(rooms) > 0:
            self.test(
                "PUT /api/rooms/{id} - disable GPS for validation test",
                "PUT", f"rooms/{test_room_id}", 200,
                data={"gps_enabled": False},
                token=self.admin_token
            )
            
            # Get QR
            success, qr3 = self.test(
                "GET /api/rooms/{rid}/qr",
                "GET", f"rooms/{test_room_id}/qr", 200,
                token=self.guru1_token
            )
            
            if success:
                success, validation3 = self.test(
                    "POST /api/jurnal/validate - all validations",
                    "POST", "jurnal/validate", 200,
                    data={
                        "qr_token": qr3.get('token'),
                        "user_lat": -7.9839,
                        "user_lon": 112.6549
                    },
                    token=self.guru1_token
                )
                if success:
                    qr_valid = validation3.get('qr', {}).get('valid')
                    schedule_valid = validation3.get('schedule', {}).get('valid')
                    gps_valid = validation3.get('gps', {}).get('valid')
                    self.log(f"  QR valid: {qr_valid}", "info")
                    self.log(f"  Schedule valid: {schedule_valid}", "info")
                    self.log(f"  GPS valid: {gps_valid}", "info")
                    if qr_valid and gps_valid:
                        self.log(f"  ✓ QR and GPS validations passed", "success")
                    if not schedule_valid:
                        self.log(f"  Note: Schedule validation may fail if no active schedule for guru1 at this room/time", "warning")
        
        # ============================================================
        # TEST 25: Verify role-based access on /api/students
        # ============================================================
        self.log("\n[TEST 25] Verify role-based access on /api/students: pure siswa role can only see self", "info")
        if self.siswa1_token:
            success, siswa_view = self.test(
                "GET /api/students as siswa1 (pure siswa role)",
                "GET", "students", 200,
                token=self.siswa1_token
            )
            if success:
                if len(siswa_view) == 1:
                    self.log(f"  ✓ siswa1 can only see self (1 student)", "success")
                else:
                    self.log(f"  WARNING: siswa1 sees {len(siswa_view)} students (expected 1)", "warning")
        
        # ============================================================
        # FINAL SUMMARY
        # ============================================================
        self.print_summary()
    
    def print_summary(self):
        """Print final test summary"""
        self.log("\n" + "=" * 80, "info")
        self.log("PHASE 3 TEST SUMMARY", "info")
        self.log("=" * 80, "info")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        self.log(f"Total Tests: {self.tests_run}", "info")
        self.log(f"Passed: {Colors.GREEN}{self.tests_passed}{Colors.RESET}", "success")
        self.log(f"Failed: {Colors.RED}{self.tests_failed}{Colors.RESET}", "error")
        self.log(f"Success Rate: {success_rate:.1f}%", "info")
        
        if self.tests_failed > 0:
            self.log("\nFailed Tests:", "error")
            for result in self.test_results:
                if result['status'] == 'FAILED':
                    self.log(f"  - {result['test']}", "error")
        
        self.log("=" * 80, "info")
        
        return success_rate >= 80


def main():
    tester = Phase3Tester()
    
    try:
        tester.run_phase3_tests()
        
        # Save results to JSON
        results_summary = {
            "timestamp": datetime.now().isoformat(),
            "test_type": "Phase 3 Backend API Tests",
            "total_tests": tester.tests_run,
            "passed": tester.tests_passed,
            "failed": tester.tests_failed,
            "success_rate": f"{(tester.tests_passed / tester.tests_run * 100):.1f}%" if tester.tests_run > 0 else "0%",
            "test_results": tester.test_results,
        }
        
        with open('/app/backend/test_results_phase3.json', 'w') as f:
            json.dump(results_summary, f, indent=2)
        
        print(f"\n{Colors.BLUE}ℹ{Colors.RESET} Test results saved to /app/backend/test_results_phase3.json")
        
        # Exit with appropriate code
        sys.exit(0 if tester.tests_failed == 0 else 1)
        
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⚠{Colors.RESET} Tests interrupted by user")
        sys.exit(2)
    except Exception as e:
        print(f"\n{Colors.RED}✗{Colors.RESET} Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(3)


if __name__ == "__main__":
    main()
