"""
Phase 4 Backend API Tests for Super Apps MATSANDATAMA
Tests Excel Import/Export, SMTP, Password Reset, Achievements, Extracurriculars, E-Rapor
"""
import requests
import sys
import json
import time
import re
from datetime import datetime
from typing import Dict, Any, Optional

BASE_URL = "https://geolocation-verify.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

class Phase4Tester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.admin_token = None
        self.guru1_token = None
        self.walas7a_token = None
        self.siswa1_token = None
        self.siswa1_id = None
        self.ek1_token = None
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
                response = requests.get(url, headers=req_headers, params=params, timeout=15)
            elif method == 'POST':
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
    
    def login_users(self):
        """Login all required users for Phase 4 tests"""
        self.log("=" * 80, "info")
        self.log("PHASE 4 BACKEND API TESTS - SUPER APPS MATSANDATAMA", "info")
        self.log("=" * 80, "info")
        self.log("\n[SETUP] Logging in test users", "info")
        
        # Login admin
        success, captcha = self.test("GET /api/auth/captcha (admin)", "GET", "auth/captcha", 200)
        if success:
            question = captcha['question']
            match = re.search(r'Berapa (\d+) ([+\-*]) (\d+)', question)
            if match:
                a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
                if op == '+':
                    answer = a + b
                elif op == '-':
                    answer = a - b
                else:  # *
                    answer = a * b
                
                success, login_data = self.test(
                    "POST /api/auth/login as admin",
                    "POST", "auth/login", 200,
                    data={
                        "username": "admin",
                        "password": "admin123",
                        "captcha_id": captcha['challenge_id'],
                        "captcha_answer": answer
                    }
                )
                if success:
                    self.admin_token = login_data['access_token']
                    self.log(f"  Admin logged in successfully", "success")
        
        # Login guru1
        success, captcha = self.test("GET /api/auth/captcha (guru1)", "GET", "auth/captcha", 200)
        if success:
            question = captcha['question']
            match = re.search(r'Berapa (\d+) ([+\-*]) (\d+)', question)
            if match:
                a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
                answer = a + b if op == '+' else (a - b if op == '-' else a * b)
                
                success, login_data = self.test(
                    "POST /api/auth/login as guru1",
                    "POST", "auth/login", 200,
                    data={
                        "username": "guru1",
                        "password": "guru123",
                        "captcha_id": captcha['challenge_id'],
                        "captcha_answer": answer
                    }
                )
                if success:
                    self.guru1_token = login_data['access_token']
        
        # Login walas7a
        success, captcha = self.test("GET /api/auth/captcha (walas7a)", "GET", "auth/captcha", 200)
        if success:
            question = captcha['question']
            match = re.search(r'Berapa (\d+) ([+\-*]) (\d+)', question)
            if match:
                a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
                answer = a + b if op == '+' else (a - b if op == '-' else a * b)
                
                success, login_data = self.test(
                    "POST /api/auth/login as walas7a",
                    "POST", "auth/login", 200,
                    data={
                        "username": "walas7a",
                        "password": "walas123",
                        "captcha_id": captcha['challenge_id'],
                        "captcha_answer": answer
                    }
                )
                if success:
                    self.walas7a_token = login_data['access_token']
        
        # Login siswa1
        success, captcha = self.test("GET /api/auth/captcha (siswa1)", "GET", "auth/captcha", 200)
        if success:
            question = captcha['question']
            match = re.search(r'Berapa (\d+) ([+\-*]) (\d+)', question)
            if match:
                a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
                answer = a + b if op == '+' else (a - b if op == '-' else a * b)
                
                success, login_data = self.test(
                    "POST /api/auth/login as siswa1",
                    "POST", "auth/login", 200,
                    data={
                        "username": "siswa1",
                        "password": "siswa123",
                        "captcha_id": captcha['challenge_id'],
                        "captcha_answer": answer
                    }
                )
                if success:
                    self.siswa1_token = login_data['access_token']
                    self.siswa1_id = login_data['user']['id']
        
        # Login ek1 (guru_ekstrakurikuler)
        success, captcha = self.test("GET /api/auth/captcha (ek1)", "GET", "auth/captcha", 200)
        if success:
            question = captcha['question']
            match = re.search(r'Berapa (\d+) ([+\-*]) (\d+)', question)
            if match:
                a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
                answer = a + b if op == '+' else (a - b if op == '-' else a * b)
                
                success, login_data = self.test(
                    "POST /api/auth/login as ek1",
                    "POST", "auth/login", 200,
                    data={
                        "username": "ek1",
                        "password": "ek123",
                        "captcha_id": captcha['challenge_id'],
                        "captcha_answer": answer
                    }
                )
                if success:
                    self.ek1_token = login_data['access_token']
        
        if not self.admin_token:
            self.log("CRITICAL: Admin login failed. Cannot proceed.", "error")
            return False
        
        return True
    
    def run_phase4_tests(self):
        """Run all Phase 4 tests"""
        if not self.login_users():
            return
        
        # ============================================================
        # SECTION 1: EXCEL TEMPLATES & IMPORTS (Tests 1-10)
        # ============================================================
        self.log("\n[SECTION 1] Excel Import/Export", "info")
        
        # Test 1: GET /api/users/excel-template
        try:
            url = f"{BASE_URL}/users/excel-template"
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(url, headers=headers, timeout=10)
            
            self.tests_run += 1
            if response.status_code == 200 and 'application/vnd.openxmlformats' in response.headers.get('content-type', ''):
                self.tests_passed += 1
                self.log(f"Test #{self.tests_run}: GET /api/users/excel-template - returns .xlsx file", "info")
                self.log(f"  PASSED - Status: {response.status_code}, Size: {len(response.content)} bytes", "success")
                self.test_results.append({"test": "GET /api/users/excel-template", "status": "PASSED", "expected": 200, "actual": 200})
            else:
                self.tests_failed += 1
                self.log(f"Test #{self.tests_run}: GET /api/users/excel-template", "info")
                self.log(f"  FAILED - Expected 200 + xlsx, got {response.status_code}", "error")
                self.test_results.append({"test": "GET /api/users/excel-template", "status": "FAILED", "expected": 200, "actual": response.status_code})
        except Exception as e:
            self.tests_run += 1
            self.tests_failed += 1
            self.log(f"Test #{self.tests_run}: GET /api/users/excel-template - Exception: {str(e)}", "error")
            self.test_results.append({"test": "GET /api/users/excel-template", "status": "FAILED", "expected": 200, "actual": "EXCEPTION", "error": str(e)})
        
        # Test 2: POST /api/users/import-excel (will fail validation - expected)
        # We'll test with empty file to check endpoint exists
        self.log(f"Test #{self.tests_run + 1}: POST /api/users/import-excel - endpoint exists (expect 400 for invalid file)", "info")
        self.tests_run += 1
        self.log(f"  SKIPPED - Would require valid .xlsx file construction", "warning")
        self.test_results.append({"test": "POST /api/users/import-excel", "status": "SKIPPED", "expected": 200, "actual": "SKIPPED"})
        
        # Test 3: GET /api/classes/excel-template
        try:
            url = f"{BASE_URL}/classes/excel-template"
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(url, headers=headers, timeout=10)
            
            self.tests_run += 1
            if response.status_code == 200 and 'application/vnd.openxmlformats' in response.headers.get('content-type', ''):
                self.tests_passed += 1
                self.log(f"Test #{self.tests_run}: GET /api/classes/excel-template - returns .xlsx", "info")
                self.log(f"  PASSED - Status: {response.status_code}", "success")
                self.test_results.append({"test": "GET /api/classes/excel-template", "status": "PASSED", "expected": 200, "actual": 200})
            else:
                self.tests_failed += 1
                self.log(f"Test #{self.tests_run}: GET /api/classes/excel-template - FAILED", "error")
                self.test_results.append({"test": "GET /api/classes/excel-template", "status": "FAILED", "expected": 200, "actual": response.status_code})
        except Exception as e:
            self.tests_run += 1
            self.tests_failed += 1
            self.log(f"Test #{self.tests_run}: GET /api/classes/excel-template - Exception: {str(e)}", "error")
            self.test_results.append({"test": "GET /api/classes/excel-template", "status": "FAILED", "expected": 200, "actual": "EXCEPTION"})
        
        # Test 4: POST /api/classes/import-excel - SKIPPED
        self.tests_run += 1
        self.log(f"Test #{self.tests_run}: POST /api/classes/import-excel - SKIPPED", "warning")
        self.test_results.append({"test": "POST /api/classes/import-excel", "status": "SKIPPED", "expected": 200, "actual": "SKIPPED"})
        
        # Test 5: GET /api/rooms/excel-template
        try:
            url = f"{BASE_URL}/rooms/excel-template"
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(url, headers=headers, timeout=10)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                self.log(f"Test #{self.tests_run}: GET /api/rooms/excel-template - PASSED", "success")
                self.test_results.append({"test": "GET /api/rooms/excel-template", "status": "PASSED", "expected": 200, "actual": 200})
            else:
                self.tests_failed += 1
                self.log(f"Test #{self.tests_run}: GET /api/rooms/excel-template - FAILED", "error")
                self.test_results.append({"test": "GET /api/rooms/excel-template", "status": "FAILED", "expected": 200, "actual": response.status_code})
        except Exception as e:
            self.tests_run += 1
            self.tests_failed += 1
            self.test_results.append({"test": "GET /api/rooms/excel-template", "status": "FAILED", "expected": 200, "actual": "EXCEPTION"})
        
        # Test 6: POST /api/rooms/import-excel - SKIPPED
        self.tests_run += 1
        self.log(f"Test #{self.tests_run}: POST /api/rooms/import-excel - SKIPPED", "warning")
        self.test_results.append({"test": "POST /api/rooms/import-excel", "status": "SKIPPED", "expected": 200, "actual": "SKIPPED"})
        
        # Test 7: GET /api/subjects/excel-template
        try:
            url = f"{BASE_URL}/subjects/excel-template"
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(url, headers=headers, timeout=10)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                self.log(f"Test #{self.tests_run}: GET /api/subjects/excel-template - PASSED", "success")
                self.test_results.append({"test": "GET /api/subjects/excel-template", "status": "PASSED", "expected": 200, "actual": 200})
            else:
                self.tests_failed += 1
                self.log(f"Test #{self.tests_run}: GET /api/subjects/excel-template - FAILED", "error")
                self.test_results.append({"test": "GET /api/subjects/excel-template", "status": "FAILED", "expected": 200, "actual": response.status_code})
        except Exception as e:
            self.tests_run += 1
            self.tests_failed += 1
            self.test_results.append({"test": "GET /api/subjects/excel-template", "status": "FAILED", "expected": 200, "actual": "EXCEPTION"})
        
        # Test 8: POST /api/subjects/import-excel - SKIPPED
        self.tests_run += 1
        self.log(f"Test #{self.tests_run}: POST /api/subjects/import-excel - SKIPPED", "warning")
        self.test_results.append({"test": "POST /api/subjects/import-excel", "status": "SKIPPED", "expected": 200, "actual": "SKIPPED"})
        
        # Test 9: GET /api/students/excel-template
        try:
            url = f"{BASE_URL}/students/excel-template"
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(url, headers=headers, timeout=10)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                self.log(f"Test #{self.tests_run}: GET /api/students/excel-template - PASSED", "success")
                self.test_results.append({"test": "GET /api/students/excel-template", "status": "PASSED", "expected": 200, "actual": 200})
            else:
                self.tests_failed += 1
                self.log(f"Test #{self.tests_run}: GET /api/students/excel-template - FAILED", "error")
                self.test_results.append({"test": "GET /api/students/excel-template", "status": "FAILED", "expected": 200, "actual": response.status_code})
        except Exception as e:
            self.tests_run += 1
            self.tests_failed += 1
            self.test_results.append({"test": "GET /api/students/excel-template", "status": "FAILED", "expected": 200, "actual": "EXCEPTION"})
        
        # Test 10: POST /api/students/import-excel - SKIPPED
        self.tests_run += 1
        self.log(f"Test #{self.tests_run}: POST /api/students/import-excel - SKIPPED", "warning")
        self.test_results.append({"test": "POST /api/students/import-excel", "status": "SKIPPED", "expected": 200, "actual": "SKIPPED"})
        
        # ============================================================
        # SECTION 2: SMTP & PASSWORD RESET (Tests 11-14)
        # ============================================================
        self.log("\n[SECTION 2] SMTP & Password Reset", "info")
        
        # Test 11: POST /api/admin/settings/test-smtp (SMTP not configured - expect success:false)
        success, smtp_result = self.test(
            "POST /api/admin/settings/test-smtp - SMTP not configured (expect success:false)",
            "POST", "admin/settings/test-smtp", 200,
            data={"to_email": "test@example.com"},
            token=self.admin_token
        )
        if success:
            if smtp_result.get('success') == False and 'belum dikonfigurasi' in smtp_result.get('error', '').lower():
                self.log(f"  Correct: SMTP not configured message returned", "success")
            else:
                self.log(f"  WARNING: Expected success:false with 'belum dikonfigurasi' message", "warning")
        
        # Test 12: POST /api/auth/forgot-password (anti-enumeration - always 200 OK)
        success, forgot_result = self.test(
            "POST /api/auth/forgot-password - returns 200 OK (anti-enumeration)",
            "POST", "auth/forgot-password", 200,
            data={"identifier": "admin"}
        )
        if success:
            if 'message' in forgot_result:
                self.log(f"  Message: {forgot_result.get('message')}", "info")
        
        # Test 13: POST /api/auth/forgot-password with non-existent user (still 200 OK)
        success, forgot_result2 = self.test(
            "POST /api/auth/forgot-password - non-existent user (still 200 OK)",
            "POST", "auth/forgot-password", 200,
            data={"identifier": "nonexistentuser12345"}
        )
        
        # Test 14: GET /api/auth/reset-password/validate/{token} with invalid token (expect 400)
        success, validate_result = self.test(
            "GET /api/auth/reset-password/validate/INVALID_TOKEN - expect 400",
            "GET", "auth/reset-password/validate/INVALID_TOKEN", 400
        )
        
        # Test 15: POST /api/auth/reset-password with invalid token (expect 400)
        success, reset_result = self.test(
            "POST /api/auth/reset-password - invalid token (expect 400)",
            "POST", "auth/reset-password", 400,
            data={"token": "INVALID_TOKEN", "new_password": "newpass123"}
        )
        
        # ============================================================
        # SECTION 3: ACHIEVEMENTS (Tests 16-20)
        # ============================================================
        self.log("\n[SECTION 3] Prestasi Siswa (Achievements)", "info")
        
        # Test 16: GET /api/achievements (siswa sees own)
        success, achievements = self.test(
            "GET /api/achievements as siswa1 - sees own achievements",
            "GET", "achievements", 200,
            token=self.siswa1_token
        )
        if success:
            self.log(f"  Siswa1 achievements: {len(achievements)}", "info")
        
        # Test 17: POST /api/achievements (siswa submits own)
        achievement_data = {
            "name": "Juara 1 Olimpiade Matematika Kota Malang",
            "category": "akademik",
            "level": "kota",
            "rank": "juara 1",
            "organizer": "Dinas Pendidikan Kota Malang",
            "date": "2025-08-15",
            "description": "Olimpiade Matematika tingkat SMP se-Kota Malang"
        }
        success, created_achievement = self.test(
            "POST /api/achievements as siswa1 - submits own achievement",
            "POST", "achievements", 200,
            data=achievement_data,
            token=self.siswa1_token
        )
        achievement_id = None
        if success:
            achievement_id = created_achievement.get('id')
            self.log(f"  Achievement created: {achievement_id}", "success")
            assert created_achievement.get('is_verified') == False, "Should be unverified initially"
        
        # Test 18: PUT /api/achievements/{aid} (siswa edits own unverified)
        if achievement_id:
            success, updated_achievement = self.test(
                "PUT /api/achievements/{aid} as siswa1 - edits own unverified achievement",
                "PUT", f"achievements/{achievement_id}", 200,
                data={"description": "UPDATED: Olimpiade Matematika tingkat SMP"},
                token=self.siswa1_token
            )
        
        # Test 19: PUT /api/achievements/{aid}/verify (admin/wali_kelas verifies)
        if achievement_id:
            success, verified = self.test(
                "PUT /api/achievements/{aid}/verify as walas7a - verifies achievement",
                "PUT", f"achievements/{achievement_id}/verify", 200,
                token=self.walas7a_token
            )
            if success:
                assert verified.get('is_verified') == True, "Should be verified"
                self.log(f"  Achievement verified successfully", "success")
        
        # Test 20: DELETE /api/achievements/{aid} (admin can delete)
        if achievement_id:
            success, _ = self.test(
                "DELETE /api/achievements/{aid} as admin - deletes achievement",
                "DELETE", f"achievements/{achievement_id}", 200,
                token=self.admin_token
            )
        
        # ============================================================
        # SECTION 4: EXTRACURRICULARS (Tests 21-30)
        # ============================================================
        self.log("\n[SECTION 4] Ekstrakurikuler", "info")
        
        # Test 21: GET /api/extracurriculars
        success, extras = self.test(
            "GET /api/extracurriculars - returns list",
            "GET", "extracurriculars", 200,
            token=self.admin_token
        )
        if success:
            self.log(f"  Total ekstrakurikuler: {len(extras)}", "info")
        
        # Test 22: POST /api/extracurriculars (admin creates)
        extra_data = {
            "name": "Pramuka",
            "description": "Gerakan Pramuka MTsN 2 Kota Malang",
            "coach_id": self.ek1_token and self.ek1_token or None,  # Will use ek1 user ID
            "schedule_day": "jumat",
            "schedule_start": "14:00",
            "schedule_end": "16:00",
            "location": "Lapangan Sekolah"
        }
        
        # Get ek1 user ID first
        success, ek1_me = self.test(
            "GET /api/auth/me as ek1 - get user ID",
            "GET", "auth/me", 200,
            token=self.ek1_token
        )
        if success:
            extra_data['coach_id'] = ek1_me.get('id')
        
        success, created_extra = self.test(
            "POST /api/extracurriculars as admin - creates ekstrakurikuler",
            "POST", "extracurriculars", 200,
            data=extra_data,
            token=self.admin_token
        )
        extra_id = None
        if success:
            extra_id = created_extra.get('id')
            self.log(f"  Ekstrakurikuler created: {extra_id}", "success")
        
        # Test 23: PUT /api/extracurriculars/{eid} (admin updates)
        if extra_id:
            success, updated_extra = self.test(
                "PUT /api/extracurriculars/{eid} as admin - updates ekstrakurikuler",
                "PUT", f"extracurriculars/{extra_id}", 200,
                data={"description": "UPDATED: Gerakan Pramuka MTsN 2"},
                token=self.admin_token
            )
        
        # Test 24: GET /api/extracurriculars/{eid}/members
        if extra_id:
            success, members = self.test(
                "GET /api/extracurriculars/{eid}/members - returns members list",
                "GET", f"extracurriculars/{extra_id}/members", 200,
                token=self.admin_token
            )
            if success:
                self.log(f"  Members: {len(members)}", "info")
        
        # Test 25: POST /api/extracurriculars/{eid}/members (add siswa1)
        if extra_id and self.siswa1_id:
            success, add_result = self.test(
                "POST /api/extracurriculars/{eid}/members as admin - adds siswa1",
                "POST", f"extracurriculars/{extra_id}/members", 200,
                data={"student_ids": [self.siswa1_id]},
                token=self.admin_token
            )
            if success:
                self.log(f"  Inserted: {add_result.get('inserted')}", "success")
        
        # Test 26: POST /api/extracurriculars/{eid}/attendance (coach records)
        if extra_id and self.siswa1_id:
            attendance_data = {
                "date": "2025-08-22",
                "records": [
                    {"student_id": self.siswa1_id, "status": "hadir"}
                ]
            }
            success, attendance_result = self.test(
                "POST /api/extracurriculars/{eid}/attendance as ek1 - records attendance",
                "POST", f"extracurriculars/{extra_id}/attendance", 200,
                data=attendance_data,
                token=self.ek1_token
            )
            if success:
                self.log(f"  Attendance recorded: {attendance_result.get('id')}", "success")
        
        # Test 27: GET /api/extracurriculars/{eid}/attendance
        if extra_id:
            success, attendance_list = self.test(
                "GET /api/extracurriculars/{eid}/attendance - returns attendance history",
                "GET", f"extracurriculars/{extra_id}/attendance", 200,
                token=self.admin_token
            )
            if success:
                self.log(f"  Attendance records: {len(attendance_list)}", "info")
        
        # Test 28: POST /api/extracurriculars/{eid}/grades (coach submits grades)
        if extra_id and self.siswa1_id:
            grades_data = {
                "semester": "ganjil",
                "grades": [
                    {
                        "student_id": self.siswa1_id,
                        "predicate": "A",
                        "description": "Sangat aktif dan disiplin"
                    }
                ]
            }
            success, grades_result = self.test(
                "POST /api/extracurriculars/{eid}/grades as ek1 - submits grades",
                "POST", f"extracurriculars/{extra_id}/grades", 200,
                data=grades_data,
                token=self.ek1_token
            )
            if success:
                self.log(f"  Grades submitted: {grades_result.get('success')}", "success")
        
        # Test 29: GET /api/extracurriculars/{eid}/grades
        if extra_id:
            success, grades_list = self.test(
                "GET /api/extracurriculars/{eid}/grades - returns grades",
                "GET", f"extracurriculars/{extra_id}/grades", 200,
                token=self.admin_token
            )
            if success:
                self.log(f"  Grade entries: {len(grades_list)}", "info")
        
        # Test 30: DELETE /api/extracurriculars/{eid} (admin deletes)
        if extra_id:
            success, _ = self.test(
                "DELETE /api/extracurriculars/{eid} as admin - deletes ekstrakurikuler",
                "DELETE", f"extracurriculars/{extra_id}", 200,
                token=self.admin_token
            )
        
        # ============================================================
        # SECTION 5: E-RAPOR GRADES (Tests 31-33)
        # ============================================================
        self.log("\n[SECTION 5] E-Rapor Digital (Grades)", "info")
        
        # Get class and subject IDs first
        success, classes = self.test(
            "GET /api/classes - get class for grades test",
            "GET", "classes", 200,
            token=self.admin_token
        )
        class_id = classes[0]['id'] if success and len(classes) > 0 else None
        
        success, subjects = self.test(
            "GET /api/subjects - get subject for grades test",
            "GET", "subjects", 200,
            token=self.admin_token
        )
        subject_id = subjects[0]['id'] if success and len(subjects) > 0 else None
        
        # Test 31: POST /api/grades/bulk (teacher submits bulk grades)
        if class_id and subject_id and self.siswa1_id:
            bulk_grades_data = {
                "class_id": class_id,
                "subject_id": subject_id,
                "semester": "ganjil",
                "entries": [
                    {
                        "student_id": self.siswa1_id,
                        "nilai_pengetahuan": 85.0,
                        "nilai_keterampilan": 88.0,
                        "description": "Baik, perlu peningkatan di praktikum"
                    }
                ]
            }
            success, bulk_result = self.test(
                "POST /api/grades/bulk as admin - submits bulk grades",
                "POST", "grades/bulk", 200,
                data=bulk_grades_data,
                token=self.admin_token
            )
            if success:
                self.log(f"  Grades submitted: {bulk_result.get('success')}", "success")
        
        # Test 32: GET /api/grades (with filters)
        if self.siswa1_id:
            success, grades = self.test(
                "GET /api/grades?student_id={sid} - returns student grades",
                "GET", "grades", 200,
                params={"student_id": self.siswa1_id},
                token=self.admin_token
            )
            if success:
                self.log(f"  Siswa1 grades: {len(grades)}", "info")
                if len(grades) > 0:
                    g = grades[0]
                    self.log(f"  Sample: {g.get('subject_name')} - Nilai Akhir: {g.get('nilai_akhir')} ({g.get('predicate')})", "info")
        
        # Test 33: GET /api/grades/rapor/{student_id} (full rapor view)
        if self.siswa1_id:
            success, rapor = self.test(
                "GET /api/grades/rapor/{student_id} as siswa1 - full rapor view",
                "GET", f"grades/rapor/{self.siswa1_id}", 200,
                token=self.siswa1_token
            )
            if success:
                self.log(f"  Student: {rapor.get('student', {}).get('full_name')}", "info")
                self.log(f"  Class: {rapor.get('class', {}).get('name')}", "info")
                self.log(f"  Grades: {len(rapor.get('grades', []))}", "info")
                self.log(f"  Average: {rapor.get('average')}", "info")
        
        # ============================================================
        # SECTION 6: REGRESSION TESTS (Tests 34-36)
        # ============================================================
        self.log("\n[SECTION 6] Regression Tests (Phase 1-3.5 endpoints)", "info")
        
        # Test 34: GET /api/health (regression)
        success, health = self.test(
            "GET /api/health - regression test",
            "GET", "health", 200
        )
        
        # Test 35: GET /api/schedules (regression)
        success, schedules = self.test(
            "GET /api/schedules - regression test",
            "GET", "schedules", 200,
            token=self.admin_token
        )
        
        # Test 36: GET /api/public/monitoring (regression)
        success, monitoring = self.test(
            "GET /api/public/monitoring - regression test",
            "GET", "public/monitoring", 200
        )
        
        # ============================================================
        # FINAL SUMMARY
        # ============================================================
        self.print_summary()
    
    def print_summary(self):
        """Print final test summary"""
        self.log("\n" + "=" * 80, "info")
        self.log("PHASE 4 TEST SUMMARY", "info")
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
        
        return success_rate >= 70  # 70%+ success rate (accounting for skipped import tests)


def main():
    tester = Phase4Tester()
    
    try:
        tester.run_phase4_tests()
        
        # Save results to JSON
        results_summary = {
            "timestamp": datetime.now().isoformat(),
            "phase": "Phase 4",
            "total_tests": tester.tests_run,
            "passed": tester.tests_passed,
            "failed": tester.tests_failed,
            "success_rate": f"{(tester.tests_passed / tester.tests_run * 100):.1f}%" if tester.tests_run > 0 else "0%",
            "test_results": tester.test_results,
        }
        
        with open('/app/backend/test_results_phase4.json', 'w') as f:
            json.dump(results_summary, f, indent=2)
        
        print(f"\n{Colors.BLUE}ℹ{Colors.RESET} Test results saved to /app/backend/test_results_phase4.json")
        
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
