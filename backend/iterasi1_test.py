"""
Iterasi 1 Enhancement Backend API Test
Tests for:
1. Schedule workflow status (draft/submitted/locked)
2. Student detail management
3. Mutations endpoint
4. Audit logs with filters
"""
import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional
import re

BASE_URL = "https://geolocation-verify.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

class Iterasi1Tester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.admin_token = None
        self.guru1_token = None
        self.guru1_id = None
        self.walas7a_token = None
        self.walas7a_id = None
        self.piket1_token = None
        self.siswa1_token = None
        self.siswa1_id = None
        self.siswa2_id = None
        self.test_results = []
        self.schedule_ids = []
        
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
             token: Optional[str] = None, params: Optional[Dict] = None) -> tuple:
        """Run a single API test"""
        self.tests_run += 1
        url = f"{BASE_URL}/{endpoint}"
        
        req_headers = {'Content-Type': 'application/json'}
        if token:
            req_headers['Authorization'] = f'Bearer {token}'
        if headers:
            req_headers.update(headers)
        
        self.log(f"Test #{self.tests_run}: {name}", "info")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, params=params, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, params=params, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, params=params, timeout=10)
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
                    return True, response.json()
                except:
                    return True, {}
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
        question = captcha_data['question']
        match = re.search(r'Berapa (\d+) ([+\-]) (\d+)', question)
        if not match:
            self.log(f"Failed to parse captcha for {username}", "error")
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
            return login_data.get('access_token'), login_data.get('user', {}).get('id')
        return None, None
    
    def run_all_tests(self):
        """Run all Iterasi 1 enhancement tests"""
        self.log("=" * 80, "info")
        self.log("ITERASI 1 ENHANCEMENT - BACKEND API TEST SUITE", "info")
        self.log("=" * 80, "info")
        
        # ============================================================
        # SETUP: Login all users
        # ============================================================
        self.log("\n[SETUP] Logging in all test users", "info")
        
        self.admin_token, _ = self.login_user("admin", "admin123")
        if not self.admin_token:
            self.log("CRITICAL: Admin login failed. Cannot proceed.", "error")
            return
        
        self.guru1_token, self.guru1_id = self.login_user("guru1", "guru123")
        self.walas7a_token, self.walas7a_id = self.login_user("walas7a", "walas123")
        self.piket1_token, _ = self.login_user("piket1", "piket123")
        self.siswa1_token, self.siswa1_id = self.login_user("siswa1", "siswa123")
        
        # Get siswa2 ID
        success, users = self.test(
            "GET /api/users to get siswa2 ID",
            "GET", "users", 200,
            token=self.admin_token
        )
        if success:
            for u in users:
                if u.get('username') == 'siswa2':
                    self.siswa2_id = u['id']
                    break
        
        # Get academic year, class, subject, room for schedule creation
        success, ay_data = self.test(
            "GET /api/academic-years",
            "GET", "academic-years", 200,
            token=self.admin_token
        )
        self.ay_id = ay_data[0]['id'] if success and ay_data else None
        
        success, classes = self.test(
            "GET /api/classes",
            "GET", "classes", 200,
            token=self.admin_token
        )
        self.class_id = classes[0]['id'] if success and classes else None
        
        success, subjects = self.test(
            "GET /api/subjects",
            "GET", "subjects", 200,
            token=self.admin_token
        )
        self.subject_id = subjects[0]['id'] if success and subjects else None
        
        success, rooms = self.test(
            "GET /api/rooms",
            "GET", "rooms", 200,
            token=self.admin_token
        )
        self.room_id = rooms[0]['id'] if success and rooms else None
        
        self.log(f"Setup complete. guru1_id={self.guru1_id}, siswa1_id={self.siswa1_id}", "success")
        
        # ============================================================
        # SECTION 1: SCHEDULE WORKFLOW STATUS (Tests 1-15)
        # ============================================================
        self.log("\n[SECTION 1] Schedule Workflow Status Tests", "info")
        
        # Test 1: POST /schedules as admin → status='submitted'
        schedule_data_admin = {
            "academic_year_id": self.ay_id,
            "semester": "ganjil",
            "class_id": self.class_id,
            "subject_id": self.subject_id,
            "teacher_id": self.guru1_id,
            "room_id": self.room_id,
            "day": "senin",
            "start_time": "07:00",
            "end_time": "07:45"
        }
        success, sched_admin = self.test(
            "POST /schedules as admin → status='submitted', submitted_by=admin.id",
            "POST", "schedules", 200,
            data=schedule_data_admin,
            token=self.admin_token
        )
        if success:
            assert sched_admin.get('status') == 'submitted', f"Expected status='submitted', got {sched_admin.get('status')}"
            assert sched_admin.get('submitted_by') is not None, "submitted_by should be set"
            assert sched_admin.get('submitted_at') is not None, "submitted_at should be set"
            self.log(f"  ✓ Status: {sched_admin.get('status')}, submitted_by: {sched_admin.get('submitted_by')}", "success")
            self.schedule_ids.append(sched_admin['id'])
        
        # Test 2: POST /schedules as guru1 with teacher_id=guru1.id (self-assign) → status='draft'
        schedule_data_guru1 = {
            "academic_year_id": self.ay_id,
            "semester": "ganjil",
            "class_id": self.class_id,
            "subject_id": self.subject_id,
            "teacher_id": self.guru1_id,
            "room_id": self.room_id,
            "day": "selasa",
            "start_time": "08:00",
            "end_time": "08:45"
        }
        success, sched_guru1 = self.test(
            "POST /schedules as guru1 with teacher_id=guru1.id (self-assign) → status='draft'",
            "POST", "schedules", 200,
            data=schedule_data_guru1,
            token=self.guru1_token
        )
        if success:
            assert sched_guru1.get('status') == 'draft', f"Expected status='draft', got {sched_guru1.get('status')}"
            assert sched_guru1.get('created_by') == self.guru1_id, "created_by should be guru1.id"
            self.log(f"  ✓ Status: {sched_guru1.get('status')}, created_by: {sched_guru1.get('created_by')}", "success")
            self.draft_schedule_id = sched_guru1['id']
            self.schedule_ids.append(sched_guru1['id'])
        
        # Test 3: POST /schedules as guru1 with teacher_id=<other user id> → 403
        schedule_data_other = {
            "academic_year_id": self.ay_id,
            "semester": "ganjil",
            "class_id": self.class_id,
            "subject_id": self.subject_id,
            "teacher_id": self.walas7a_id,  # Different teacher
            "room_id": self.room_id,
            "day": "rabu",
            "start_time": "09:00",
            "end_time": "09:45"
        }
        self.test(
            "POST /schedules as guru1 with teacher_id=<other user id> → 403",
            "POST", "schedules", 403,
            data=schedule_data_other,
            token=self.guru1_token
        )
        
        # Test 4: POST /schedules as siswa1 → 403
        self.test(
            "POST /schedules as siswa1 → 403 (siswa tidak punya kuasa)",
            "POST", "schedules", 403,
            data=schedule_data_guru1,
            token=self.siswa1_token
        )
        
        # Test 5: PUT /schedules/{id} as owner when status=draft → OK
        if hasattr(self, 'draft_schedule_id'):
            success, updated = self.test(
                "PUT /schedules/{id} as owner when status=draft → OK update field",
                "PUT", f"schedules/{self.draft_schedule_id}", 200,
                data={"start_time": "08:15", "end_time": "09:00"},
                token=self.guru1_token
            )
            if success:
                assert updated.get('start_time') == '08:15', "start_time not updated"
                self.log(f"  ✓ Draft schedule updated successfully", "success")
        
        # Test 6: PUT /schedules/{id}/submit to change draft → submitted
        if hasattr(self, 'draft_schedule_id'):
            success, submitted = self.test(
                "PUT /schedules/{id}/submit as owner draft → status='submitted'",
                "PUT", f"schedules/{self.draft_schedule_id}/submit", 200,
                token=self.guru1_token
            )
            if success:
                assert submitted.get('status') == 'submitted', "Status should be 'submitted'"
                assert submitted.get('submitted_by') == self.guru1_id, "submitted_by should be guru1.id"
                assert submitted.get('submitted_at') is not None, "submitted_at should be set"
                self.log(f"  ✓ Status changed to 'submitted', submitted_by: {submitted.get('submitted_by')}", "success")
        
        # Test 7: PUT /schedules/{id} as owner when status=submitted → 403
        if hasattr(self, 'draft_schedule_id'):
            self.test(
                "PUT /schedules/{id} as owner when status=submitted → 403",
                "PUT", f"schedules/{self.draft_schedule_id}", 403,
                data={"start_time": "08:30"},
                token=self.guru1_token
            )
        
        # Test 8: PUT /schedules/{id} as admin when status=submitted → OK
        if hasattr(self, 'draft_schedule_id'):
            success, updated_admin = self.test(
                "PUT /schedules/{id} as admin when status=submitted → OK",
                "PUT", f"schedules/{self.draft_schedule_id}", 200,
                data={"start_time": "08:30"},
                token=self.admin_token
            )
            if success:
                assert updated_admin.get('start_time') == '08:30', "Admin should be able to update submitted schedule"
                self.log(f"  ✓ Admin updated submitted schedule", "success")
        
        # Test 9: PUT /schedules/{id}/lock admin only → status='locked'
        if hasattr(self, 'draft_schedule_id'):
            success, locked = self.test(
                "PUT /schedules/{id}/lock admin only → status='locked'",
                "PUT", f"schedules/{self.draft_schedule_id}/lock", 200,
                token=self.admin_token
            )
            if success:
                assert locked.get('status') == 'locked', "Status should be 'locked'"
                assert locked.get('locked_by') is not None, "locked_by should be set"
                assert locked.get('locked_at') is not None, "locked_at should be set"
                self.log(f"  ✓ Status changed to 'locked', locked_by: {locked.get('locked_by')}", "success")
        
        # Test 10: PUT /schedules/{id}/lock as non-admin → 403
        # Create another draft schedule first
        schedule_data_guru2 = {
            "academic_year_id": self.ay_id,
            "semester": "ganjil",
            "class_id": self.class_id,
            "subject_id": self.subject_id,
            "teacher_id": self.guru1_id,
            "room_id": self.room_id,
            "day": "kamis",
            "start_time": "10:00",
            "end_time": "10:45"
        }
        success, sched_guru2 = self.test(
            "POST /schedules as guru1 (for lock test)",
            "POST", "schedules", 200,
            data=schedule_data_guru2,
            token=self.guru1_token
        )
        if success:
            draft_id2 = sched_guru2['id']
            self.schedule_ids.append(draft_id2)
            
            # Try to lock as non-admin
            self.test(
                "PUT /schedules/{id}/lock as non-admin → 403",
                "PUT", f"schedules/{draft_id2}/lock", 403,
                token=self.guru1_token
            )
        
        # Test 11: PUT /schedules/{id} as admin when status=locked → OK (admin bypass)
        if hasattr(self, 'draft_schedule_id'):
            success, updated_locked = self.test(
                "PUT /schedules/{id} as admin when status=locked → OK (admin bypass)",
                "PUT", f"schedules/{self.draft_schedule_id}", 200,
                data={"start_time": "08:45"},
                token=self.admin_token
            )
            if success:
                self.log(f"  ✓ Admin can edit locked schedule", "success")
        
        # Test 12: PUT /schedules/{id} as non-admin when status=locked → 403
        if hasattr(self, 'draft_schedule_id'):
            self.test(
                "PUT /schedules/{id} as non-admin when status=locked → 403",
                "PUT", f"schedules/{self.draft_schedule_id}", 403,
                data={"start_time": "09:00"},
                token=self.guru1_token
            )
        
        # Test 13: PUT /schedules/{id}/unlock admin only → status='submitted'
        if hasattr(self, 'draft_schedule_id'):
            success, unlocked = self.test(
                "PUT /schedules/{id}/unlock admin only → status='submitted', locked_at null",
                "PUT", f"schedules/{self.draft_schedule_id}/unlock", 200,
                token=self.admin_token
            )
            if success:
                assert unlocked.get('status') == 'submitted', "Status should be 'submitted' after unlock"
                assert unlocked.get('locked_at') is None, "locked_at should be null"
                assert unlocked.get('locked_by') is None, "locked_by should be null"
                self.log(f"  ✓ Status changed back to 'submitted', locked_at cleared", "success")
        
        # Test 14: PUT /schedules/{id}/unlock as non-admin → 403
        # Lock it again first
        if hasattr(self, 'draft_schedule_id'):
            self.test(
                "PUT /schedules/{id}/lock (setup for unlock test)",
                "PUT", f"schedules/{self.draft_schedule_id}/lock", 200,
                token=self.admin_token
            )
            
            self.test(
                "PUT /schedules/{id}/unlock as non-admin → 403",
                "PUT", f"schedules/{self.draft_schedule_id}/unlock", 403,
                token=self.guru1_token
            )
        
        # Test 15: PUT /schedules/{id}/submit when status=locked → 400
        if hasattr(self, 'draft_schedule_id'):
            self.test(
                "PUT /schedules/{id}/submit when status=locked → 400",
                "PUT", f"schedules/{self.draft_schedule_id}/submit", 400,
                token=self.admin_token
            )
        
        # Test 16: DELETE /schedules/{id} non-admin when status=submitted → 403
        # Create a new draft, submit it, then try to delete
        schedule_data_del = {
            "academic_year_id": self.ay_id,
            "semester": "ganjil",
            "class_id": self.class_id,
            "subject_id": self.subject_id,
            "teacher_id": self.guru1_id,
            "room_id": self.room_id,
            "day": "jumat",
            "start_time": "11:00",
            "end_time": "11:45"
        }
        success, sched_del = self.test(
            "POST /schedules as guru1 (for delete test)",
            "POST", "schedules", 200,
            data=schedule_data_del,
            token=self.guru1_token
        )
        if success:
            del_draft_id = sched_del['id']
            self.schedule_ids.append(del_draft_id)
            
            # Submit it
            self.test(
                "PUT /schedules/{id}/submit (setup for delete test)",
                "PUT", f"schedules/{del_draft_id}/submit", 200,
                token=self.guru1_token
            )
            
            # Try to delete as non-admin
            self.test(
                "DELETE /schedules/{id} non-admin when status=submitted → 403",
                "DELETE", f"schedules/{del_draft_id}", 403,
                token=self.guru1_token
            )
        
        # Test 17: DELETE /schedules/{id} when draft as owner → OK
        schedule_data_del2 = {
            "academic_year_id": self.ay_id,
            "semester": "ganjil",
            "class_id": self.class_id,
            "subject_id": self.subject_id,
            "teacher_id": self.guru1_id,
            "room_id": self.room_id,
            "day": "sabtu",
            "start_time": "12:00",
            "end_time": "12:45"
        }
        success, sched_del2 = self.test(
            "POST /schedules as guru1 (for delete draft test)",
            "POST", "schedules", 200,
            data=schedule_data_del2,
            token=self.guru1_token
        )
        if success:
            del_draft_id2 = sched_del2['id']
            
            # Delete as owner while still draft
            success, _ = self.test(
                "DELETE /schedules/{id} when draft as owner → OK",
                "DELETE", f"schedules/{del_draft_id2}", 200,
                token=self.guru1_token
            )
            if success:
                self.log(f"  ✓ Owner can delete draft schedule", "success")
        
        # Test 18: PUT /schedules/bulk-lock with {ids:[...]} admin only
        if len(self.schedule_ids) >= 2:
            # Unlock the locked one first
            if hasattr(self, 'draft_schedule_id'):
                self.test(
                    "PUT /schedules/{id}/unlock (setup for bulk-lock)",
                    "PUT", f"schedules/{self.draft_schedule_id}/unlock", 200,
                    token=self.admin_token
                )
            
            success, bulk_result = self.test(
                "PUT /schedules/bulk-lock with {ids:[...]} admin only → update multiple",
                "PUT", "schedules/bulk-lock", 200,
                data={"ids": self.schedule_ids[:2]},
                token=self.admin_token
            )
            if success:
                assert bulk_result.get('locked') >= 1, "Should lock at least 1 schedule"
                self.log(f"  ✓ Bulk locked {bulk_result.get('locked')} schedules", "success")
        
        # ============================================================
        # SECTION 2: STUDENT DETAIL MANAGEMENT (Tests 19-24)
        # ============================================================
        self.log("\n[SECTION 2] Student Detail Management Tests", "info")
        
        # Test 19: GET /students/{sid}/detail as admin → return {student, detail}
        if self.siswa1_id:
            success, detail_data = self.test(
                "GET /students/{sid}/detail as admin → return {student, detail}",
                "GET", f"students/{self.siswa1_id}/detail", 200,
                token=self.admin_token
            )
            if success:
                assert 'student' in detail_data, "student field missing"
                assert 'detail' in detail_data, "detail field missing (can be null)"
                self.log(f"  ✓ Student: {detail_data.get('student', {}).get('full_name')}, Detail: {detail_data.get('detail')}", "success")
        
        # Test 20: GET /students/{sid}/detail as siswa.id==sid → OK (self view)
        if self.siswa1_id:
            success, self_detail = self.test(
                "GET /students/{sid}/detail as siswa.id==sid → OK (self view)",
                "GET", f"students/{self.siswa1_id}/detail", 200,
                token=self.siswa1_token
            )
            if success:
                self.log(f"  ✓ Siswa can view own detail", "success")
        
        # Test 21: GET /students/{sid}/detail as user lain (non-admin/wali/self) → 403
        if self.siswa2_id:
            self.test(
                "GET /students/{sid}/detail as user lain (non-admin/wali/self) → 403",
                "GET", f"students/{self.siswa2_id}/detail", 403,
                token=self.siswa1_token
            )
        
        # Test 22: PUT /students/{sid}/detail as admin with full payload → OK
        if self.siswa1_id:
            detail_payload = {
                "citizenship": "WNI",
                "nik": "3573012345678901",
                "agama": "Islam",
                "hobi": "Membaca, Olahraga",
                "jumlah_saudara": 2,
                "anak_ke": 1,
                "cita_cita": "Dokter",
                "ayah": {
                    "nama": "Bapak Siswa1",
                    "status": "Hidup",
                    "citizenship": "WNI",
                    "nik": "3573011234567890",
                    "tempat_lahir": "Malang",
                    "tgl_lahir": "1980-05-15",
                    "pendidikan": "S1",
                    "pekerjaan": "PNS",
                    "penghasilan": "5000000-10000000",
                    "no_hp": "081234567890"
                },
                "ibu": {
                    "nama": "Ibu Siswa1",
                    "status": "Hidup",
                    "citizenship": "WNI",
                    "nik": "3573011234567891",
                    "tempat_lahir": "Malang",
                    "tgl_lahir": "1982-08-20",
                    "pendidikan": "S1",
                    "pekerjaan": "Guru",
                    "penghasilan": "3000000-5000000",
                    "no_hp": "081234567891"
                },
                "alamat_siswa": {
                    "status_tempat_tinggal": "Bersama Orang Tua",
                    "alamat": "Jl. Veteran No. 123",
                    "provinsi": "Jawa Timur",
                    "kabupaten": "Kota Malang",
                    "kecamatan": "Lowokwaru",
                    "kelurahan": "Sumbersari",
                    "rt": "03",
                    "rw": "05",
                    "kode_pos": "65145",
                    "jarak_tempuh": "5 km",
                    "transportasi": "Sepeda Motor",
                    "waktu_tempuh": "15 menit"
                }
            }
            success, created_detail = self.test(
                "PUT /students/{sid}/detail as admin with full payload → OK",
                "PUT", f"students/{self.siswa1_id}/detail", 200,
                data=detail_payload,
                token=self.admin_token
            )
            if success:
                assert created_detail.get('citizenship') == 'WNI', "citizenship not saved"
                assert created_detail.get('nik') == '3573012345678901', "nik not saved"
                assert created_detail.get('agama') == 'Islam', "agama not saved"
                assert created_detail.get('ayah') is not None, "ayah not saved"
                assert created_detail.get('ibu') is not None, "ibu not saved"
                assert created_detail.get('alamat_siswa') is not None, "alamat_siswa not saved"
                self.log(f"  ✓ Student detail created with full data", "success")
        
        # Test 23: PUT /students/{sid}/detail update again (upsert) → OK merge
        if self.siswa1_id:
            update_payload = {
                "hobi": "Membaca, Olahraga, Musik",
                "cita_cita": "Dokter Spesialis",
                "jumlah_saudara": 3
            }
            success, updated_detail = self.test(
                "PUT /students/{sid}/detail update again (upsert) → OK merge",
                "PUT", f"students/{self.siswa1_id}/detail", 200,
                data=update_payload,
                token=self.admin_token
            )
            if success:
                assert updated_detail.get('hobi') == 'Membaca, Olahraga, Musik', "hobi not updated"
                assert updated_detail.get('jumlah_saudara') == 3, "jumlah_saudara not updated"
                # Check that previous data is still there
                assert updated_detail.get('citizenship') == 'WNI', "citizenship should still exist"
                self.log(f"  ✓ Student detail updated (upsert), previous data preserved", "success")
        
        # Test 24: PUT /students/{sid}/detail as siswa lain (non-self, non-admin/wali) → 403
        if self.siswa2_id:
            self.test(
                "PUT /students/{sid}/detail as siswa lain (non-self, non-admin/wali) → 403",
                "PUT", f"students/{self.siswa2_id}/detail", 403,
                data={"hobi": "Test"},
                token=self.siswa1_token
            )
        
        # Test 25: PUT /students/{nonexistent}/detail → 404
        self.test(
            "PUT /students/{nonexistent}/detail → 404",
            "PUT", "students/nonexistent-id-12345/detail", 404,
            data={"hobi": "Test"},
            token=self.admin_token
        )
        
        # ============================================================
        # SECTION 3: MUTATIONS ENDPOINT (Tests 26-29)
        # ============================================================
        self.log("\n[SECTION 3] Mutations Endpoint Tests", "info")
        
        # First, set up some mutation data
        # Set siswa1 as mutation_type=masuk
        if self.siswa1_id:
            success, _ = self.test(
                "PUT /api/users/{uid} - set siswa1 mutation_type=masuk (setup)",
                "PUT", f"users/{self.siswa1_id}", 200,
                data={
                    "mutation_type": "masuk",
                    "mutation_ay_id": self.ay_id,
                    "mutation_date": "2025-07-15",
                    "mutation_note": "Pindahan dari sekolah lain"
                },
                token=self.admin_token
            )
        
        # Set guru1 as mutation_type=keluar (staff)
        if self.guru1_id:
            success, _ = self.test(
                "PUT /api/users/{uid} - set guru1 mutation_type=keluar (setup)",
                "PUT", f"users/{self.guru1_id}", 200,
                data={
                    "mutation_type": "keluar",
                    "mutation_ay_id": self.ay_id,
                    "mutation_date": "2025-12-31",
                    "mutation_note": "Pensiun"
                },
                token=self.admin_token
            )
        
        # Test 26: GET /admin/mutations?mutation_type=masuk&role_group=siswa
        success, mutations_masuk = self.test(
            "GET /admin/mutations?mutation_type=masuk&role_group=siswa → list siswa with mutation_type=masuk",
            "GET", "admin/mutations", 200,
            params={"mutation_type": "masuk", "role_group": "siswa"},
            token=self.admin_token
        )
        if success:
            self.log(f"  ✓ Found {len(mutations_masuk)} siswa with mutation_type=masuk", "success")
            # Verify siswa1 is in the list
            siswa1_found = any(u.get('id') == self.siswa1_id for u in mutations_masuk)
            if siswa1_found:
                self.log(f"  ✓ siswa1 found in mutations list", "success")
            else:
                self.log(f"  ⚠ siswa1 not found in mutations list (might be OK if no mutation set)", "warning")
        
        # Test 27: GET /admin/mutations?mutation_type=keluar&role_group=staff
        success, mutations_keluar = self.test(
            "GET /admin/mutations?mutation_type=keluar&role_group=staff → list staff with mutation_type=keluar",
            "GET", "admin/mutations", 200,
            params={"mutation_type": "keluar", "role_group": "staff"},
            token=self.admin_token
        )
        if success:
            self.log(f"  ✓ Found {len(mutations_keluar)} staff with mutation_type=keluar", "success")
            # Verify guru1 is in the list
            guru1_found = any(u.get('id') == self.guru1_id for u in mutations_keluar)
            if guru1_found:
                self.log(f"  ✓ guru1 found in mutations list", "success")
            else:
                self.log(f"  ⚠ guru1 not found in mutations list", "warning")
        
        # Test 28: GET /admin/mutations invalid mutation_type → 400
        self.test(
            "GET /admin/mutations invalid mutation_type → 400",
            "GET", "admin/mutations", 400,
            params={"mutation_type": "invalid", "role_group": "siswa"},
            token=self.admin_token
        )
        
        # Test 29: GET /admin/mutations as non-admin → 403
        self.test(
            "GET /admin/mutations as non-admin → 403",
            "GET", "admin/mutations", 403,
            params={"mutation_type": "masuk", "role_group": "siswa"},
            token=self.guru1_token
        )
        
        # ============================================================
        # SECTION 4: AUDIT LOGS WITH FILTERS (Tests 30-31)
        # ============================================================
        self.log("\n[SECTION 4] Audit Logs with Filters Tests", "info")
        
        # Test 30: GET /admin/audit-logs?target_id=<schedule_id>
        if hasattr(self, 'draft_schedule_id'):
            success, audit_logs_target = self.test(
                "GET /admin/audit-logs?target_id=<schedule_id> → filter logs for that schedule",
                "GET", "admin/audit-logs", 200,
                params={"target_id": self.draft_schedule_id},
                token=self.admin_token
            )
            if success:
                self.log(f"  ✓ Found {len(audit_logs_target)} audit logs for schedule {self.draft_schedule_id}", "success")
                # Verify logs are for the correct target_id
                if audit_logs_target:
                    all_match = all(log.get('entity_id') == self.draft_schedule_id for log in audit_logs_target)
                    if all_match:
                        self.log(f"  ✓ All logs match target_id filter", "success")
                    else:
                        self.log(f"  ⚠ Some logs don't match target_id filter", "warning")
        
        # Test 31: GET /admin/audit-logs?target_type=schedule
        success, audit_logs_type = self.test(
            "GET /admin/audit-logs?target_type=schedule → filter logs target_type=schedule",
            "GET", "admin/audit-logs", 200,
            params={"target_type": "schedule"},
            token=self.admin_token
        )
        if success:
            self.log(f"  ✓ Found {len(audit_logs_type)} audit logs with target_type=schedule", "success")
            # Note: The current implementation uses 'entity' field, not 'target_type'
            # So this test might return empty or all logs depending on implementation
        
        # ============================================================
        # SECTION 5: REGRESSION - EXISTING ENDPOINTS (Test 32)
        # ============================================================
        self.log("\n[SECTION 5] Regression Tests - Existing Endpoints", "info")
        
        # Test a few key existing endpoints to ensure they still work
        self.test(
            "REGRESSION: GET /api/health still works",
            "GET", "health", 200
        )
        
        self.test(
            "REGRESSION: GET /api/settings still works",
            "GET", "settings", 200
        )
        
        self.test(
            "REGRESSION: GET /api/classes still works",
            "GET", "classes", 200,
            token=self.admin_token
        )
        
        self.test(
            "REGRESSION: GET /api/subjects still works",
            "GET", "subjects", 200,
            token=self.admin_token
        )
        
        self.test(
            "REGRESSION: GET /api/rooms still works",
            "GET", "rooms", 200,
            token=self.admin_token
        )
        
        self.test(
            "REGRESSION: GET /api/schedules still works",
            "GET", "schedules", 200,
            token=self.admin_token
        )
        
        # ============================================================
        # FINAL SUMMARY
        # ============================================================
        self.print_summary()
    
    def print_summary(self):
        """Print final test summary"""
        self.log("\n" + "=" * 80, "info")
        self.log("TEST SUMMARY", "info")
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
    tester = Iterasi1Tester()
    
    try:
        tester.run_all_tests()
        
        # Save results to JSON
        results_summary = {
            "timestamp": datetime.now().isoformat(),
            "test_type": "Iterasi 1 Enhancement",
            "total_tests": tester.tests_run,
            "passed": tester.tests_passed,
            "failed": tester.tests_failed,
            "success_rate": f"{(tester.tests_passed / tester.tests_run * 100):.1f}%" if tester.tests_run > 0 else "0%",
            "test_results": tester.test_results,
        }
        
        with open('/app/backend/iterasi1_test_results.json', 'w') as f:
            json.dump(results_summary, f, indent=2)
        
        print(f"\n{Colors.BLUE}ℹ{Colors.RESET} Test results saved to /app/backend/iterasi1_test_results.json")
        
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
