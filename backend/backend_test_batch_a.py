"""
Comprehensive Backend API Test for Super Apps MATSANDATAMA - Batch A Features
Tests all Batch A enhancements as specified in the review request.
"""
import requests
import sys
import json
import time
import io
from datetime import datetime
from typing import Dict, Any, Optional

BASE_URL = "https://geolocation-verify.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

class BatchATester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.admin_token = None
        self.guru1_token = None
        self.walas7a_token = None
        self.piket1_token = None
        self.siswa1_token = None
        self.tendik1_token = None
        self.test_results = []
        self.class_7a_id = None
        self.schedule_id = None
        self.task_id = None
        self.weekly_holiday_id = None
        self.academic_holiday_id = None
        
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
        if not files:
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
                    response = requests.post(url, files=files, data=data, headers=req_headers, params=params, timeout=30)
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
                    return True, response.json()
                except:
                    return True, response.content if files else {}
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
            self.log(f"  EXCEPTION - {str(e)}", "error")
            result = {
                "test": name,
                "status": "EXCEPTION",
                "expected": expected_status,
                "actual": 0,
                "error": str(e),
            }
            self.test_results.append(result)
            return False, {}
    
    def get_captcha(self):
        """Get captcha for login"""
        try:
            resp = requests.get(f"{BASE_URL}/auth/captcha", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                # Simple math captcha solver
                question = data['question']
                # Parse "Berapa X + Y?" or "Berapa X - Y?"
                import re
                match = re.search(r'(\d+)\s*([+\-*/])\s*(\d+)', question)
                if match:
                    a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
                    if op == '+': answer = a + b
                    elif op == '-': answer = a - b
                    elif op == '*': answer = a * b
                    elif op == '/': answer = a // b
                    else: answer = 0
                    return data['challenge_id'], answer
            return None, None
        except Exception as e:
            self.log(f"Captcha error: {e}", "error")
            return None, None
    
    def login(self, username: str, password: str) -> Optional[str]:
        """Login and return token"""
        captcha_id, captcha_answer = self.get_captcha()
        if not captcha_id:
            self.log(f"Failed to get captcha for {username}", "error")
            return None
        
        success, response = self.test(
            f"Login as {username}",
            "POST",
            "auth/login",
            200,
            data={
                "username": username,
                "password": password,
                "captcha_id": captcha_id,
                "captcha_answer": captcha_answer
            }
        )
        
        if success and 'access_token' in response:
            self.log(f"  Token obtained for {username}", "success")
            return response['access_token']
        else:
            self.log(f"  Login failed for {username}", "error")
            return None
    
    def run_all_tests(self):
        """Run all Batch A tests"""
        self.log("=" * 80, "info")
        self.log("BATCH A FEATURE TESTS - Super Apps MATSANDATAMA", "info")
        self.log("=" * 80, "info")
        
        # ============================================================
        # AUTHENTICATION
        # ============================================================
        self.log("\n[1] AUTHENTICATION TESTS", "info")
        self.log("-" * 80, "info")
        
        self.admin_token = self.login("admin", "admin123")
        self.guru1_token = self.login("guru1", "guru123")
        self.walas7a_token = self.login("walas7a", "walas123")
        self.piket1_token = self.login("piket1", "piket123")
        self.siswa1_token = self.login("siswa1", "siswa123")
        self.tendik1_token = self.login("tendik1", "tendik123")
        
        if not self.admin_token:
            self.log("CRITICAL: Admin login failed. Cannot continue tests.", "error")
            return
        
        # ============================================================
        # FEATURE 1: CLASSES WITH CAPACITY & STUDENT_COUNT
        # ============================================================
        self.log("\n[2] CLASSES API - CAPACITY & STUDENT_COUNT", "info")
        self.log("-" * 80, "info")
        
        # Get classes list
        success, classes = self.test(
            "GET /api/classes returns student_count + capacity",
            "GET",
            "classes",
            200,
            token=self.admin_token
        )
        
        if success and classes:
            # Verify enrichment
            sample_class = classes[0] if classes else None
            if sample_class:
                has_student_count = 'student_count' in sample_class
                has_capacity = 'capacity' in sample_class
                has_homeroom_name = 'homeroom_teacher_name' in sample_class
                has_room_name = 'room_name' in sample_class
                
                if has_student_count and has_capacity:
                    self.log(f"  ✓ Class enrichment OK: student_count={sample_class.get('student_count')}, capacity={sample_class.get('capacity')}", "success")
                    self.class_7a_id = sample_class.get('id')
                else:
                    self.log(f"  ✗ Missing fields: student_count={has_student_count}, capacity={has_capacity}", "error")
        
        # Create new class with capacity
        success, new_class = self.test(
            "POST /api/classes with capacity field",
            "POST",
            "classes",
            200,
            data={
                "name": "Test-Batch-A",
                "grade": 7,
                "parallel": "Z",
                "academic_year_id": "ay-2025-2026",
                "capacity": 35
            },
            token=self.admin_token
        )
        
        if success:
            test_class_id = new_class.get('id')
            # Update class capacity
            success, updated = self.test(
                "PUT /api/classes update capacity",
                "PUT",
                f"classes/{test_class_id}",
                200,
                data={"capacity": 40},
                token=self.admin_token
            )
            
            if success and updated.get('capacity') == 40:
                self.log(f"  ✓ Capacity updated to 40", "success")
        
        # ============================================================
        # FEATURE 2: WEEKLY HOLIDAYS CRUD
        # ============================================================
        self.log("\n[3] WEEKLY HOLIDAYS CRUD", "info")
        self.log("-" * 80, "info")
        
        # GET weekly holidays (all roles)
        success, holidays = self.test(
            "GET /api/weekly-holidays (all roles)",
            "GET",
            "weekly-holidays",
            200,
            token=self.guru1_token
        )
        
        # POST weekly holiday (admin only)
        success, new_holiday = self.test(
            "POST /api/weekly-holidays (admin only)",
            "POST",
            "weekly-holidays",
            200,
            data={
                "day": "minggu",
                "description": "Libur mingguan",
                "is_active": True
            },
            token=self.admin_token
        )
        
        if success:
            self.weekly_holiday_id = new_holiday.get('id')
        
        # POST duplicate day (should fail with 400)
        success, _ = self.test(
            "POST /api/weekly-holidays duplicate day → 400",
            "POST",
            "weekly-holidays",
            400,
            data={
                "day": "minggu",
                "description": "Duplicate",
                "is_active": True
            },
            token=self.admin_token
        )
        
        # POST by non-admin (should fail with 403)
        success, _ = self.test(
            "POST /api/weekly-holidays by guru → 403",
            "POST",
            "weekly-holidays",
            403,
            data={
                "day": "sabtu",
                "description": "Test",
                "is_active": True
            },
            token=self.guru1_token
        )
        
        # PUT weekly holiday (admin only)
        if self.weekly_holiday_id:
            success, _ = self.test(
                "PUT /api/weekly-holidays/{id} (admin only)",
                "PUT",
                f"weekly-holidays/{self.weekly_holiday_id}",
                200,
                data={"description": "Updated description"},
                token=self.admin_token
            )
            
            # PUT by non-admin (should fail)
            success, _ = self.test(
                "PUT /api/weekly-holidays/{id} by guru → 403",
                "PUT",
                f"weekly-holidays/{self.weekly_holiday_id}",
                403,
                data={"description": "Unauthorized"},
                token=self.guru1_token
            )
        
        # ============================================================
        # FEATURE 3: ACADEMIC HOLIDAYS CRUD
        # ============================================================
        self.log("\n[4] ACADEMIC HOLIDAYS CRUD", "info")
        self.log("-" * 80, "info")
        
        # GET academic holidays
        success, holidays = self.test(
            "GET /api/academic-holidays",
            "GET",
            "academic-holidays",
            200,
            token=self.admin_token
        )
        
        # GET with year filter
        success, holidays_2026 = self.test(
            "GET /api/academic-holidays?year=2026",
            "GET",
            "academic-holidays",
            200,
            params={"year": 2026},
            token=self.admin_token
        )
        
        # POST academic holiday (admin only)
        success, new_ah = self.test(
            "POST /api/academic-holidays (admin only)",
            "POST",
            "academic-holidays",
            200,
            data={
                "date": "2026-08-17",
                "name": "Hari Kemerdekaan RI",
                "category": "libur_nasional",
                "description": "Test holiday"
            },
            token=self.admin_token
        )
        
        if success:
            self.academic_holiday_id = new_ah.get('id')
        
        # POST with missing fields (should fail)
        success, _ = self.test(
            "POST /api/academic-holidays missing date → 400",
            "POST",
            "academic-holidays",
            400,
            data={
                "name": "Test"
            },
            token=self.admin_token
        )
        
        # POST by non-admin (should fail)
        success, _ = self.test(
            "POST /api/academic-holidays by guru → 403",
            "POST",
            "academic-holidays",
            403,
            data={
                "date": "2026-12-25",
                "name": "Test"
            },
            token=self.guru1_token
        )
        
        # PUT academic holiday
        if self.academic_holiday_id:
            success, _ = self.test(
                "PUT /api/academic-holidays/{id} (admin only)",
                "PUT",
                f"academic-holidays/{self.academic_holiday_id}",
                200,
                data={"description": "Updated"},
                token=self.admin_token
            )
            
            # PUT by non-admin
            success, _ = self.test(
                "PUT /api/academic-holidays/{id} by guru → 403",
                "PUT",
                f"academic-holidays/{self.academic_holiday_id}",
                403,
                data={"description": "Unauthorized"},
                token=self.guru1_token
            )
        
        # DELETE academic holiday
        if self.academic_holiday_id:
            success, _ = self.test(
                "DELETE /api/academic-holidays/{id} (admin only)",
                "DELETE",
                f"academic-holidays/{self.academic_holiday_id}",
                200,
                token=self.admin_token
            )
        
        # ============================================================
        # FEATURE 4: PUBLIC HOLIDAYS TODAY (NO AUTH)
        # ============================================================
        self.log("\n[5] PUBLIC HOLIDAYS TODAY (NO AUTH)", "info")
        self.log("-" * 80, "info")
        
        success, today_info = self.test(
            "GET /api/public/holidays/today (NO AUTH)",
            "GET",
            "public/holidays/today",
            200
        )
        
        if success:
            required_fields = ['date', 'day', 'is_weekly_holiday', 'is_academic_holiday']
            has_all = all(f in today_info for f in required_fields)
            if has_all:
                self.log(f"  ✓ All required fields present: {required_fields}", "success")
            else:
                self.log(f"  ✗ Missing fields in response", "error")
        
        # ============================================================
        # FEATURE 5: BACKUP & RESTORE
        # ============================================================
        self.log("\n[6] BACKUP & RESTORE", "info")
        self.log("-" * 80, "info")
        
        # GET backup info (admin only)
        success, backup_info = self.test(
            "GET /api/admin/backup/info (admin only)",
            "GET",
            "admin/backup/info",
            200,
            token=self.admin_token
        )
        
        if success:
            has_collections = 'collections' in backup_info
            has_total = 'total_documents' in backup_info
            if has_collections and has_total:
                self.log(f"  ✓ Backup info: {backup_info.get('total_documents')} total documents", "success")
        
        # GET backup export (download .json)
        success, export_data = self.test(
            "GET /api/admin/backup/export (download .json)",
            "GET",
            "admin/backup/export",
            200,
            token=self.admin_token
        )
        
        if success and export_data:
            # Verify it's JSON content
            try:
                if isinstance(export_data, bytes):
                    backup_json = json.loads(export_data.decode('utf-8'))
                else:
                    backup_json = export_data
                
                if 'collections' in backup_json:
                    self.log(f"  ✓ Backup export successful, contains collections", "success")
                    
                    # Test import with merge mode
                    # Create a small test backup for safe import
                    test_backup = {
                        "version": 1,
                        "exported_at": datetime.now().isoformat(),
                        "collections": {
                            "weekly_holidays": [
                                {
                                    "id": "test-import-wh",
                                    "day": "sabtu",
                                    "description": "Test import",
                                    "is_active": True,
                                    "created_at": datetime.now().isoformat()
                                }
                            ]
                        }
                    }
                    
                    # POST backup import (merge mode)
                    backup_file = io.BytesIO(json.dumps(test_backup).encode('utf-8'))
                    success, import_result = self.test(
                        "POST /api/admin/backup/import mode=merge",
                        "POST",
                        "admin/backup/import",
                        200,
                        files={'file': ('test_backup.json', backup_file, 'application/json')},
                        data={'mode': 'merge'},
                        token=self.admin_token
                    )
                    
                    if success:
                        self.log(f"  ✓ Import merge successful: {import_result}", "success")
                    
                    # POST backup import with invalid JSON (should fail)
                    invalid_file = io.BytesIO(b"invalid json content")
                    success, _ = self.test(
                        "POST /api/admin/backup/import invalid JSON → 400",
                        "POST",
                        "admin/backup/import",
                        400,
                        files={'file': ('invalid.json', invalid_file, 'application/json')},
                        data={'mode': 'merge'},
                        token=self.admin_token
                    )
                    
            except Exception as e:
                self.log(f"  ✗ Backup export parsing error: {e}", "error")
        
        # GET backup logs
        success, logs = self.test(
            "GET /api/admin/backup/logs",
            "GET",
            "admin/backup/logs",
            200,
            token=self.admin_token
        )
        
        # ============================================================
        # FEATURE 6: STUDENT MUTATION
        # ============================================================
        self.log("\n[7] STUDENT MUTATION", "info")
        self.log("-" * 80, "info")
        
        # Get a student user first
        success, users = self.test(
            "GET /api/users?role=siswa",
            "GET",
            "users",
            200,
            params={"role": "siswa"},
            token=self.admin_token
        )
        
        if success and users:
            test_student_id = users[0].get('id')
            
            # PUT mutation masuk
            success, mutated = self.test(
                "PUT /api/admin/users/{uid}/mutation type=masuk",
                "PUT",
                f"admin/users/{test_student_id}/mutation",
                200,
                data={
                    "mutation_type": "masuk",
                    "mutation_date": "2026-01-15",
                    "mutation_note": "Pindahan dari sekolah lain"
                },
                token=self.admin_token
            )
            
            if success:
                if mutated.get('mutation_type') == 'masuk' and mutated.get('is_active') == True:
                    self.log(f"  ✓ Mutation masuk: is_active=True", "success")
            
            # PUT mutation keluar
            success, mutated = self.test(
                "PUT /api/admin/users/{uid}/mutation type=keluar",
                "PUT",
                f"admin/users/{test_student_id}/mutation",
                200,
                data={
                    "mutation_type": "keluar",
                    "mutation_date": "2026-06-30",
                    "mutation_note": "Pindah ke sekolah lain"
                },
                token=self.admin_token
            )
            
            if success:
                if mutated.get('mutation_type') == 'keluar' and mutated.get('is_active') == False:
                    self.log(f"  ✓ Mutation keluar: is_active=False", "success")
            
            # PUT mutation clear (null)
            success, mutated = self.test(
                "PUT /api/admin/users/{uid}/mutation type=null (clear)",
                "PUT",
                f"admin/users/{test_student_id}/mutation",
                200,
                data={
                    "mutation_type": None
                },
                token=self.admin_token
            )
            
            # PUT invalid mutation_type
            success, _ = self.test(
                "PUT /api/admin/users/{uid}/mutation invalid type → 400",
                "PUT",
                f"admin/users/{test_student_id}/mutation",
                400,
                data={
                    "mutation_type": "invalid"
                },
                token=self.admin_token
            )
        
        # ============================================================
        # FEATURE 7: TEACHER TASKS (TUGAS TITIPAN)
        # ============================================================
        self.log("\n[8] TEACHER TASKS (TUGAS TITIPAN)", "info")
        self.log("-" * 80, "info")
        
        # Get schedules for guru1
        success, schedules = self.test(
            "GET /api/schedules?teacher_id=guru1",
            "GET",
            "schedules",
            200,
            token=self.guru1_token
        )
        
        if success and schedules:
            self.schedule_id = schedules[0].get('id')
            
            # POST teacher task (guru pengampu)
            success, task = self.test(
                "POST /api/teacher-tasks (guru pengampu)",
                "POST",
                "teacher-tasks",
                200,
                data={
                    "schedule_id": self.schedule_id,
                    "date": "2026-08-20",
                    "task_content": "Kerjakan LKS halaman 10-15",
                    "notes": "Tolong disampaikan ke siswa"
                },
                token=self.guru1_token
            )
            
            if success:
                self.task_id = task.get('id')
                self.log(f"  ✓ Task created: {self.task_id}", "success")
            
            # POST teacher task missing fields
            success, _ = self.test(
                "POST /api/teacher-tasks missing fields → 400",
                "POST",
                "teacher-tasks",
                400,
                data={
                    "schedule_id": self.schedule_id
                },
                token=self.guru1_token
            )
            
            # POST teacher task by non-owner (should fail)
            success, _ = self.test(
                "POST /api/teacher-tasks by non-owner → 403",
                "POST",
                "teacher-tasks",
                403,
                data={
                    "schedule_id": self.schedule_id,
                    "date": "2026-08-21",
                    "task_content": "Test"
                },
                token=self.walas7a_token
            )
            
            # POST teacher task by pure siswa (should fail)
            success, _ = self.test(
                "POST /api/teacher-tasks by siswa → 403",
                "POST",
                "teacher-tasks",
                403,
                data={
                    "schedule_id": self.schedule_id,
                    "date": "2026-08-21",
                    "task_content": "Test"
                },
                token=self.siswa1_token
            )
        
        # GET teacher tasks (teacher sees own)
        success, tasks = self.test(
            "GET /api/teacher-tasks (teacher sees own)",
            "GET",
            "teacher-tasks",
            200,
            token=self.guru1_token
        )
        
        # GET teacher tasks (admin/piket see all)
        success, all_tasks = self.test(
            "GET /api/teacher-tasks (admin sees all)",
            "GET",
            "teacher-tasks",
            200,
            token=self.admin_token
        )
        
        # PUT teacher task (owner)
        if self.task_id:
            success, _ = self.test(
                "PUT /api/teacher-tasks/{tid} by owner",
                "PUT",
                f"teacher-tasks/{self.task_id}",
                200,
                data={"notes": "Updated notes"},
                token=self.guru1_token
            )
            
            # PUT by non-owner
            success, _ = self.test(
                "PUT /api/teacher-tasks/{tid} by non-owner → 403",
                "PUT",
                f"teacher-tasks/{self.task_id}",
                403,
                data={"notes": "Unauthorized"},
                token=self.walas7a_token
            )
        
        # ============================================================
        # FEATURE 8: PIKET SCHEDULES & FILL JOURNAL
        # ============================================================
        self.log("\n[9] PIKET SCHEDULES & FILL JOURNAL", "info")
        self.log("-" * 80, "info")
        
        # GET piket schedules today (admin/guru_piket only)
        success, piket_schedules = self.test(
            "GET /api/piket/schedules/today (guru_piket)",
            "GET",
            "piket/schedules/today",
            200,
            token=self.piket1_token
        )
        
        if success:
            self.log(f"  ✓ Found {len(piket_schedules)} schedules today", "success")
            
            # Verify enrichment
            if piket_schedules:
                sample = piket_schedules[0]
                has_journal_flag = 'has_journal' in sample
                has_task_info = 'task' in sample
                if has_journal_flag:
                    self.log(f"  ✓ Schedule enriched with has_journal flag", "success")
        
        # GET by pure guru (not piket) - should fail
        success, _ = self.test(
            "GET /api/piket/schedules/today by pure guru → 403",
            "GET",
            "piket/schedules/today",
            403,
            token=self.guru1_token
        )
        
        # POST piket fill journal
        if piket_schedules and self.task_id:
            # Find a schedule without journal
            target_schedule = None
            for s in piket_schedules:
                if not s.get('has_journal'):
                    target_schedule = s
                    break
            
            if target_schedule:
                success, journal = self.test(
                    "POST /api/piket/fill-journal (guru_piket)",
                    "POST",
                    "piket/fill-journal",
                    200,
                    data={
                        "schedule_id": target_schedule['id'],
                        "materi": "Tugas dari guru (titipan piket)",
                        "catatan": "Diisi oleh guru piket",
                        "siswa_hadir": 30,
                        "siswa_tidak_hadir": 2,
                        "task_id": self.task_id,
                        "piket_note": "Guru berhalangan hadir"
                    },
                    token=self.piket1_token
                )
                
                if success:
                    # Verify journal fields
                    if (journal.get('fill_mode') == 'piket' and 
                        journal.get('filled_by_user_id') and 
                        journal.get('task_id') == self.task_id):
                        self.log(f"  ✓ Journal created with fill_mode=piket, task linked", "success")
                    
                    # Verify task status updated to completed
                    success, task_check = self.test(
                        "Verify task status = completed",
                        "GET",
                        "teacher-tasks",
                        200,
                        token=self.admin_token
                    )
                    
                    if success:
                        completed_task = next((t for t in task_check if t.get('id') == self.task_id), None)
                        if completed_task and completed_task.get('status') == 'completed':
                            self.log(f"  ✓ Task auto-completed after piket fill", "success")
                
                # POST piket fill journal again (should fail - double fill)
                success, _ = self.test(
                    "POST /api/piket/fill-journal duplicate → 400",
                    "POST",
                    "piket/fill-journal",
                    400,
                    data={
                        "schedule_id": target_schedule['id'],
                        "materi": "Duplicate",
                        "siswa_hadir": 30
                    },
                    token=self.piket1_token
                )
        
        # DELETE teacher task (completed should fail)
        if self.task_id:
            success, _ = self.test(
                "DELETE /api/teacher-tasks/{tid} completed → 400",
                "DELETE",
                f"teacher-tasks/{self.task_id}",
                400,
                token=self.guru1_token
            )
        
        # ============================================================
        # FEATURE 9: ADMIN JURNAL WITH FILLED_BY_NAME
        # ============================================================
        self.log("\n[10] ADMIN JURNAL ENRICHMENT (filled_by_name)", "info")
        self.log("-" * 80, "info")
        
        success, journals = self.test(
            "GET /api/admin/jurnal (enriched with filled_by_name)",
            "GET",
            "admin/jurnal",
            200,
            token=self.admin_token
        )
        
        if success and journals:
            items = journals.get('items', [])
            # Find a piket-filled journal
            piket_journal = next((j for j in items if j.get('fill_mode') == 'piket'), None)
            if piket_journal:
                if 'filled_by_name' in piket_journal:
                    self.log(f"  ✓ Piket journal has filled_by_name: {piket_journal.get('filled_by_name')}", "success")
                else:
                    self.log(f"  ⚠ Piket journal missing filled_by_name", "warning")
        
        # ============================================================
        # REGRESSION TESTS
        # ============================================================
        self.log("\n[11] REGRESSION TESTS (Existing Endpoints)", "info")
        self.log("-" * 80, "info")
        
        # Test existing endpoints still work
        success, _ = self.test(
            "GET /api/auth/me (regression)",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        
        success, _ = self.test(
            "GET /api/schedules (regression)",
            "GET",
            "schedules",
            200,
            token=self.admin_token
        )
        
        success, _ = self.test(
            "GET /api/admin/stats (regression)",
            "GET",
            "admin/stats",
            200,
            token=self.admin_token
        )
        
        # ============================================================
        # SUMMARY
        # ============================================================
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        self.log("\n" + "=" * 80, "info")
        self.log("TEST SUMMARY - BATCH A FEATURES", "info")
        self.log("=" * 80, "info")
        
        total = self.tests_run
        passed = self.tests_passed
        failed = self.tests_failed
        pass_rate = (passed / total * 100) if total > 0 else 0
        
        self.log(f"Total Tests: {total}", "info")
        self.log(f"Passed: {passed} ({pass_rate:.1f}%)", "success" if pass_rate >= 80 else "warning")
        self.log(f"Failed: {failed}", "error" if failed > 0 else "info")
        
        # Save results to JSON
        results = {
            "timestamp": datetime.now().isoformat(),
            "total_tests": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": pass_rate,
            "test_results": self.test_results
        }
        
        with open('/app/backend/test_results_batch_a.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        self.log("\nResults saved to: /app/backend/test_results_batch_a.json", "info")
        
        return 0 if failed == 0 else 1

def main():
    tester = BatchATester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
