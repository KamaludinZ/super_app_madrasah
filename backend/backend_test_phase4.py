"""
Phase 4 Backend API Test - Achievements & Admin Stats
Tests all Phase 4 achievement endpoints and admin statistics.
"""
import requests
import sys
import json
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
        self.tendik1_token = None
        self.siswa1_id = None
        self.guru1_id = None
        self.tendik1_id = None
        self.achievement_siswa_id = None
        self.achievement_guru_id = None
        self.achievement_tendik_id = None
        self.achievement_madrasah_id = None
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
            self.log(f"  EXCEPTION - {str(e)}", "error")
            result = {
                "test": name,
                "status": "EXCEPTION",
                "expected": expected_status,
                "actual": "N/A",
                "error": str(e),
            }
            self.test_results.append(result)
            return False, {}
    
    def get_captcha_and_answer(self):
        """Get captcha and calculate answer"""
        success, captcha_data = self.test(
            "GET /api/auth/captcha",
            "GET", "auth/captcha", 200
        )
        if not success:
            return None, None
        
        question = captcha_data.get('question', '')
        match = re.search(r'Berapa (\d+) ([+\-]) (\d+)', question)
        if match:
            a, op, b = int(match.group(1)), match.group(2), int(match.group(3))
            answer = a + b if op == '+' else a - b
            return captcha_data['challenge_id'], answer
        return None, None
    
    def login_user(self, username: str, password: str) -> Optional[str]:
        """Login and return token"""
        captcha_id, captcha_answer = self.get_captcha_and_answer()
        if not captcha_id:
            self.log(f"Failed to get captcha for {username}", "error")
            return None
        
        success, login_data = self.test(
            f"POST /api/auth/login as {username}",
            "POST", "auth/login", 200,
            data={
                "username": username,
                "password": password,
                "captcha_id": captcha_id,
                "captcha_answer": captcha_answer
            }
        )
        if success:
            token = login_data.get('access_token')
            user_id = login_data.get('user', {}).get('id')
            self.log(f"  {username} logged in successfully. ID: {user_id}", "success")
            return token, user_id
        return None, None
    
    def run_all_tests(self):
        """Run all Phase 4 tests"""
        self.log("=" * 80, "info")
        self.log("PHASE 4 - ACHIEVEMENTS & ADMIN STATS TEST SUITE", "info")
        self.log("=" * 80, "info")
        
        # ============================================================
        # SECTION 1: LOGIN ALL USERS
        # ============================================================
        self.log("\n[SECTION 1] Login All Test Users", "info")
        
        self.admin_token, _ = self.login_user("admin", "admin123")
        if not self.admin_token:
            self.log("CRITICAL: Admin login failed. Cannot proceed.", "error")
            return
        
        self.guru1_token, self.guru1_id = self.login_user("guru1", "guru123")
        self.walas7a_token, _ = self.login_user("walas7a", "walas123")
        self.siswa1_token, self.siswa1_id = self.login_user("siswa1", "siswa123")
        self.tendik1_token, self.tendik1_id = self.login_user("tendik1", "tendik123")
        
        # ============================================================
        # SECTION 2: ADMIN STATS ENDPOINTS
        # ============================================================
        self.log("\n[SECTION 2] Admin Stats Endpoints", "info")
        
        # Test: GET /api/admin/stats/students (admin only)
        success, stats_students = self.test(
            "GET /api/admin/stats/students (admin only) - should return student statistics",
            "GET", "admin/stats/students", 200,
            token=self.admin_token
        )
        if success:
            assert 'total' in stats_students, "total missing"
            assert 'kelas_7' in stats_students, "kelas_7 missing"
            assert 'kelas_8' in stats_students, "kelas_8 missing"
            assert 'kelas_9' in stats_students, "kelas_9 missing"
            assert 'mutasi_total' in stats_students, "mutasi_total missing"
            assert 'mutasi_masuk' in stats_students, "mutasi_masuk missing"
            assert 'mutasi_keluar' in stats_students, "mutasi_keluar missing"
            assert 'academic_year' in stats_students, "academic_year missing"
            self.log(f"  Total students: {stats_students.get('total')}", "info")
            self.log(f"  Kelas 7: {stats_students.get('kelas_7')}, Kelas 8: {stats_students.get('kelas_8')}, Kelas 9: {stats_students.get('kelas_9')}", "info")
            self.log(f"  Mutasi: {stats_students.get('mutasi_total')} (Masuk: {stats_students.get('mutasi_masuk')}, Keluar: {stats_students.get('mutasi_keluar')})", "info")
        
        # Test: GET /api/admin/stats/students (non-admin) - should return 401 or 403
        success, _ = self.test(
            "GET /api/admin/stats/students (non-admin) - should return 401 or 403",
            "GET", "admin/stats/students", 403,
            token=self.siswa1_token
        )
        
        # Test: GET /api/admin/stats/achievements (admin only)
        success, stats_achievements = self.test(
            "GET /api/admin/stats/achievements (admin only) - should return achievement statistics",
            "GET", "admin/stats/achievements", 200,
            token=self.admin_token
        )
        if success:
            assert 'total' in stats_achievements, "total missing"
            assert 'verified' in stats_achievements, "verified missing"
            assert 'kab_kota' in stats_achievements, "kab_kota missing"
            assert 'provinsi' in stats_achievements, "provinsi missing"
            assert 'nasional' in stats_achievements, "nasional missing"
            assert 'internasional' in stats_achievements, "internasional missing"
            assert 'by_holder' in stats_achievements, "by_holder missing"
            assert 'by_level' in stats_achievements, "by_level missing"
            self.log(f"  Total achievements: {stats_achievements.get('total')}", "info")
            self.log(f"  Verified: {stats_achievements.get('verified')}", "info")
            self.log(f"  By level - Kab/Kota: {stats_achievements.get('kab_kota')}, Provinsi: {stats_achievements.get('provinsi')}, Nasional: {stats_achievements.get('nasional')}, Internasional: {stats_achievements.get('internasional')}", "info")
            self.log(f"  By holder: {stats_achievements.get('by_holder')}", "info")
        
        # ============================================================
        # SECTION 3: ACHIEVEMENTS - GET WITH FILTERS
        # ============================================================
        self.log("\n[SECTION 3] Achievements - GET with Filters", "info")
        
        # Test: GET /api/achievements (no filter)
        success, achievements_all = self.test(
            "GET /api/achievements - should return all achievements",
            "GET", "achievements", 200,
            token=self.admin_token
        )
        if success:
            self.log(f"  Total achievements: {len(achievements_all)}", "info")
        
        # Test: GET /api/achievements?holder_type=siswa
        success, achievements_siswa = self.test(
            "GET /api/achievements?holder_type=siswa - should filter siswa only",
            "GET", "achievements", 200,
            params={"holder_type": "siswa"},
            token=self.admin_token
        )
        if success:
            self.log(f"  Siswa achievements: {len(achievements_siswa)}", "info")
        
        # Test: GET /api/achievements?holder_type=guru
        success, achievements_guru = self.test(
            "GET /api/achievements?holder_type=guru - should filter guru only",
            "GET", "achievements", 200,
            params={"holder_type": "guru"},
            token=self.admin_token
        )
        if success:
            self.log(f"  Guru achievements: {len(achievements_guru)}", "info")
        
        # Test: GET /api/achievements?holder_type=tendik
        success, achievements_tendik = self.test(
            "GET /api/achievements?holder_type=tendik - should filter tendik only",
            "GET", "achievements", 200,
            params={"holder_type": "tendik"},
            token=self.admin_token
        )
        if success:
            self.log(f"  Tendik achievements: {len(achievements_tendik)}", "info")
        
        # Test: GET /api/achievements?holder_type=madrasah
        success, achievements_madrasah = self.test(
            "GET /api/achievements?holder_type=madrasah - should filter madrasah only",
            "GET", "achievements", 200,
            params={"holder_type": "madrasah"},
            token=self.admin_token
        )
        if success:
            self.log(f"  Madrasah achievements: {len(achievements_madrasah)}", "info")
        
        # Test: GET /api/achievements?year=2025
        success, achievements_2025 = self.test(
            "GET /api/achievements?year=2025 - should filter by year",
            "GET", "achievements", 200,
            params={"year": 2025},
            token=self.admin_token
        )
        if success:
            self.log(f"  Achievements in 2025: {len(achievements_2025)}", "info")
        
        # Test: GET /api/achievements?level=nasional
        success, achievements_nasional = self.test(
            "GET /api/achievements?level=nasional - should filter by level",
            "GET", "achievements", 200,
            params={"level": "nasional"},
            token=self.admin_token
        )
        if success:
            self.log(f"  National level achievements: {len(achievements_nasional)}", "info")
        
        # ============================================================
        # SECTION 4: ACHIEVEMENTS - POST (CREATE)
        # ============================================================
        self.log("\n[SECTION 4] Achievements - POST (Create)", "info")
        
        # Test: POST /api/achievements with holder_type='siswa' by siswa1 (for self)
        success, achievement_siswa = self.test(
            "POST /api/achievements - siswa creates achievement for self",
            "POST", "achievements", 200,
            data={
                "holder_type": "siswa",
                "name": "Juara 1 Olimpiade Matematika",
                "bidang_lomba": "Matematika",
                "category": "akademik",
                "level": "nasional",
                "rank": "Juara 1",
                "organizer": "Kemendikbud",
                "date": "2025-03-15",
                "description": "Olimpiade Sains Nasional 2025"
            },
            token=self.siswa1_token
        )
        if success:
            self.achievement_siswa_id = achievement_siswa.get('id')
            self.log(f"  Achievement created: {self.achievement_siswa_id}", "success")
            assert achievement_siswa.get('holder_type') == 'siswa', "holder_type should be siswa"
            assert achievement_siswa.get('year') == 2025, "year should auto-derive to 2025"
        
        # Test: POST /api/achievements with holder_type='siswa' by siswa for OTHER student - should fail 403
        success, _ = self.test(
            "POST /api/achievements - siswa tries to create for OTHER student - should fail 403",
            "POST", "achievements", 403,
            data={
                "holder_type": "siswa",
                "holder_id": "other-student-id",
                "name": "Test Achievement",
                "level": "sekolah"
            },
            token=self.siswa1_token
        )
        
        # Test: POST /api/achievements with holder_type='guru' by guru1 (for self)
        if self.guru1_token and self.guru1_id:
            success, achievement_guru = self.test(
                "POST /api/achievements - guru creates achievement for self",
                "POST", "achievements", 200,
                data={
                    "holder_type": "guru",
                    "name": "Guru Berprestasi Tingkat Kota",
                    "bidang_lomba": "Pendidikan",
                    "category": "non-akademik",
                    "level": "kab_kota",
                    "rank": "Juara 1",
                    "organizer": "Dinas Pendidikan Kota Malang",
                    "date": "2025-05-20"
                },
                token=self.guru1_token
            )
            if success:
                self.achievement_guru_id = achievement_guru.get('id')
                self.log(f"  Guru achievement created: {self.achievement_guru_id}", "success")
                assert achievement_guru.get('holder_type') == 'guru', "holder_type should be guru"
        
        # Test: POST /api/achievements with holder_type='guru' by non-admin for OTHER user - should fail 403
        if self.guru1_token:
            success, _ = self.test(
                "POST /api/achievements - guru tries to create for OTHER guru - should fail 403",
                "POST", "achievements", 403,
                data={
                    "holder_type": "guru",
                    "holder_id": "other-guru-id",
                    "name": "Test Achievement"
                },
                token=self.guru1_token
            )
        
        # Test: POST /api/achievements with holder_type='tendik' by tendik1 (for self)
        if self.tendik1_token and self.tendik1_id:
            success, achievement_tendik = self.test(
                "POST /api/achievements - tendik creates achievement for self",
                "POST", "achievements", 200,
                data={
                    "holder_type": "tendik",
                    "name": "Tenaga Kependidikan Teladan",
                    "bidang_lomba": "Administrasi",
                    "category": "non-akademik",
                    "level": "provinsi",
                    "rank": "Juara 2",
                    "organizer": "Dinas Pendidikan Provinsi Jawa Timur",
                    "date": "2025-06-10"
                },
                token=self.tendik1_token
            )
            if success:
                self.achievement_tendik_id = achievement_tendik.get('id')
                self.log(f"  Tendik achievement created: {self.achievement_tendik_id}", "success")
                assert achievement_tendik.get('holder_type') == 'tendik', "holder_type should be tendik"
        
        # Test: POST /api/achievements with holder_type='madrasah' by admin
        success, achievement_madrasah = self.test(
            "POST /api/achievements - admin creates madrasah achievement",
            "POST", "achievements", 200,
            data={
                "holder_type": "madrasah",
                "holder_name": "MTsN 2 Kota Malang",
                "name": "Madrasah Berprestasi Tingkat Nasional",
                "bidang_lomba": "Kelembagaan",
                "category": "non-akademik",
                "level": "nasional",
                "rank": "Juara 1",
                "organizer": "Kementerian Agama RI",
                "date": "2025-08-15"
            },
            token=self.admin_token
        )
        if success:
            self.achievement_madrasah_id = achievement_madrasah.get('id')
            self.log(f"  Madrasah achievement created: {self.achievement_madrasah_id}", "success")
            assert achievement_madrasah.get('holder_type') == 'madrasah', "holder_type should be madrasah"
            assert achievement_madrasah.get('holder_id') is None, "holder_id should be None for madrasah"
        
        # Test: POST /api/achievements with holder_type='madrasah' by non-admin - should fail 403
        success, _ = self.test(
            "POST /api/achievements - non-admin tries to create madrasah achievement - should fail 403",
            "POST", "achievements", 403,
            data={
                "holder_type": "madrasah",
                "holder_name": "Test Madrasah",
                "name": "Test Achievement"
            },
            token=self.guru1_token
        )
        
        # Test: POST /api/achievements with year auto-derive from date
        success, achievement_auto_year = self.test(
            "POST /api/achievements - year auto-derives from date when year is empty",
            "POST", "achievements", 200,
            data={
                "holder_type": "siswa",
                "name": "Test Auto Year",
                "date": "2024-12-25",
                "level": "sekolah"
            },
            token=self.siswa1_token
        )
        if success:
            assert achievement_auto_year.get('year') == 2024, "year should auto-derive to 2024"
            self.log(f"  Year auto-derived: {achievement_auto_year.get('year')}", "success")
        
        # Test: POST /api/achievements with invalid holder_type - should fail 400
        success, _ = self.test(
            "POST /api/achievements - invalid holder_type - should fail 400",
            "POST", "achievements", 400,
            data={
                "holder_type": "invalid_type",
                "name": "Test Achievement"
            },
            token=self.admin_token
        )
        
        # ============================================================
        # SECTION 5: ACHIEVEMENTS - PUT (UPDATE)
        # ============================================================
        self.log("\n[SECTION 5] Achievements - PUT (Update)", "info")
        
        # Test: PUT /api/achievements/{id} - owner can edit unverified achievement
        if self.achievement_siswa_id:
            success, updated = self.test(
                "PUT /api/achievements/{id} - owner edits unverified achievement",
                "PUT", f"achievements/{self.achievement_siswa_id}", 200,
                data={
                    "description": "Updated description by owner",
                    "rank": "Juara 1 (Updated)"
                },
                token=self.siswa1_token
            )
            if success:
                assert updated.get('description') == "Updated description by owner", "description should be updated"
                self.log(f"  Achievement updated by owner", "success")
        
        # Test: PUT /api/achievements/{id}/verify - admin verifies achievement
        if self.achievement_siswa_id:
            success, verified = self.test(
                "PUT /api/achievements/{id}/verify - admin verifies achievement",
                "PUT", f"achievements/{self.achievement_siswa_id}/verify", 200,
                token=self.admin_token
            )
            if success:
                assert verified.get('is_verified') == True, "should be verified"
                assert verified.get('verified_by') is not None, "verified_by should be set"
                self.log(f"  Achievement verified by admin", "success")
        
        # Test: PUT /api/achievements/{id}/verify - wali_kelas can verify
        if self.achievement_guru_id and self.walas7a_token:
            success, verified_wk = self.test(
                "PUT /api/achievements/{id}/verify - wali_kelas verifies achievement",
                "PUT", f"achievements/{self.achievement_guru_id}/verify", 200,
                token=self.walas7a_token
            )
            if success:
                assert verified_wk.get('is_verified') == True, "should be verified"
                self.log(f"  Achievement verified by wali_kelas", "success")
        
        # ============================================================
        # SECTION 6: ACHIEVEMENTS - DELETE
        # ============================================================
        self.log("\n[SECTION 6] Achievements - DELETE", "info")
        
        # Create a test achievement to delete
        success, achievement_to_delete = self.test(
            "POST /api/achievements - create achievement to test delete",
            "POST", "achievements", 200,
            data={
                "holder_type": "siswa",
                "name": "Test Achievement for Delete",
                "level": "sekolah"
            },
            token=self.siswa1_token
        )
        
        if success:
            delete_id = achievement_to_delete.get('id')
            
            # Test: DELETE /api/achievements/{id} - owner can delete own achievement
            success, _ = self.test(
                "DELETE /api/achievements/{id} - owner deletes own achievement",
                "DELETE", f"achievements/{delete_id}", 200,
                token=self.siswa1_token
            )
            if success:
                self.log(f"  Achievement deleted by owner", "success")
        
        # Test: DELETE /api/achievements/{id} - admin can delete any achievement
        if self.achievement_tendik_id:
            success, _ = self.test(
                "DELETE /api/achievements/{id} - admin deletes any achievement",
                "DELETE", f"achievements/{self.achievement_tendik_id}", 200,
                token=self.admin_token
            )
            if success:
                self.log(f"  Achievement deleted by admin", "success")
        
        # ============================================================
        # SECTION 7: REGRESSION - OTHER ENDPOINTS STILL WORK
        # ============================================================
        self.log("\n[SECTION 7] Regression - Verify Other Endpoints Still Work", "info")
        
        # Test: GET /api/health
        success, health = self.test(
            "GET /api/health - should still work",
            "GET", "health", 200
        )
        if success:
            assert health.get('status') == 'healthy', "health status should be healthy"
            self.log(f"  Health endpoint working", "success")
        
        # Test: GET /api/schedules
        success, schedules = self.test(
            "GET /api/schedules - should still work",
            "GET", "schedules", 200,
            token=self.admin_token
        )
        if success:
            self.log(f"  Schedules endpoint working ({len(schedules)} schedules)", "success")
        
        # Test: GET /api/users
        success, users = self.test(
            "GET /api/users - should still work",
            "GET", "users", 200,
            token=self.admin_token
        )
        if success:
            self.log(f"  Users endpoint working ({len(users)} users)", "success")
        
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
                if result['status'] in ['FAILED', 'EXCEPTION']:
                    self.log(f"  - {result['test']}", "error")
        
        self.log("=" * 80, "info")
        
        return success_rate >= 80  # Consider 80%+ as success


def main():
    tester = Phase4Tester()
    
    try:
        tester.run_all_tests()
        
        # Save results to JSON
        results_summary = {
            "timestamp": datetime.now().isoformat(),
            "test_suite": "Phase 4 - Achievements & Admin Stats",
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
