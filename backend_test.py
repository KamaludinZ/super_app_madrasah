#!/usr/bin/env python3
"""
Backend Test Suite for Fase 2 Web Push (VAPID) Notifications
Super Apps MATSANDATAMA - MTsN 2 Kota Malang

Tests all 8 required scenarios for Web Push backend functionality.
"""
import os
import re
import sys
import requests
from typing import Dict, Optional, Tuple

# Configuration
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://android-ios-launch.preview.emergentagent.com")
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# Test data
FAKE_SUBSCRIPTION = {
    "subscription": {
        "endpoint": "https://fcm.googleapis.com/fcm/send/FAKE-TEST-ENDPOINT-123",
        "keys": {
            "p256dh": "BExampleFakeKeyForTestingOnly0000000000000000000000000000000000000000000000000000000000",
            "auth": "FakeAuthSecret1234567"
        }
    }
}

# Test results tracking
test_results = []


def log_test(test_num: int, name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✓ PASS" if passed else "✗ FAIL"
    result = f"TEST {test_num}: {status} - {name}"
    if details:
        result += f"\n  Details: {details}"
    test_results.append((test_num, passed, name, details))
    print(result)
    return passed


def solve_captcha(question: str) -> Optional[int]:
    """Parse and solve simple math captcha like 'Berapa 18 - 14 = ?'"""
    try:
        # Extract numbers and operator
        match = re.search(r'(\d+)\s*([\+\-\*\/])\s*(\d+)', question)
        if not match:
            return None
        
        num1 = int(match.group(1))
        operator = match.group(2)
        num2 = int(match.group(3))
        
        if operator == '+':
            return num1 + num2
        elif operator == '-':
            return num1 - num2
        elif operator == '*':
            return num1 * num2
        elif operator == '/':
            return int(num1 / num2)
        return None
    except Exception as e:
        print(f"Error solving captcha: {e}")
        return None


def get_auth_token() -> Tuple[Optional[str], str]:
    """Get authentication token by solving captcha and logging in"""
    try:
        # Step 1: Get captcha
        captcha_resp = requests.get(f"{API_BASE}/auth/captcha", timeout=10)
        if captcha_resp.status_code != 200:
            return None, f"Captcha endpoint failed: {captcha_resp.status_code}"
        
        captcha_data = captcha_resp.json()
        challenge_id = captcha_data.get("challenge_id")
        question = captcha_data.get("question")
        
        if not challenge_id or not question:
            return None, f"Invalid captcha response: {captcha_data}"
        
        # Step 2: Solve captcha
        answer = solve_captcha(question)
        if answer is None:
            return None, f"Could not solve captcha: {question}"
        
        # Step 3: Login
        login_payload = {
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD,
            "captcha_id": challenge_id,
            "captcha_answer": answer
        }
        
        login_resp = requests.post(
            f"{API_BASE}/auth/login",
            json=login_payload,
            timeout=10
        )
        
        if login_resp.status_code != 200:
            return None, f"Login failed: {login_resp.status_code} - {login_resp.text}"
        
        login_data = login_resp.json()
        token = login_data.get("access_token")
        
        if not token:
            return None, f"No access_token in response: {login_data}"
        
        return token, "Login successful"
    
    except Exception as e:
        return None, f"Auth error: {str(e)}"


def test_1_vapid_public_key():
    """TEST 1: GET /api/push/vapid-public-key (no auth required)"""
    try:
        resp = requests.get(f"{API_BASE}/push/vapid-public-key", timeout=10)
        
        if resp.status_code != 200:
            return log_test(1, "VAPID public key endpoint", False, 
                          f"Expected 200, got {resp.status_code}")
        
        data = resp.json()
        enabled = data.get("enabled")
        public_key = data.get("public_key")
        
        if not enabled:
            return log_test(1, "VAPID public key endpoint", False, 
                          "enabled is not true")
        
        if not public_key or len(public_key) == 0:
            return log_test(1, "VAPID public key endpoint", False, 
                          "public_key is empty")
        
        return log_test(1, "VAPID public key endpoint", True, 
                       f"enabled={enabled}, public_key length={len(public_key)}")
    
    except Exception as e:
        return log_test(1, "VAPID public key endpoint", False, str(e))


def test_2_subscribe(token: str):
    """TEST 2: POST /api/push/subscribe with fake subscription"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(
            f"{API_BASE}/push/subscribe",
            json=FAKE_SUBSCRIPTION,
            headers=headers,
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_test(2, "Subscribe to push", False, 
                          f"Expected 200, got {resp.status_code} - {resp.text}")
        
        data = resp.json()
        message = data.get("message")
        
        return log_test(2, "Subscribe to push", True, 
                       f"Subscribed successfully: {message}")
    
    except Exception as e:
        return log_test(2, "Subscribe to push", False, str(e))


def test_3_push_status(token: str):
    """TEST 3: GET /api/push/status - should show subscribed=true, devices>=1"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(
            f"{API_BASE}/push/status",
            headers=headers,
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_test(3, "Push status check", False, 
                          f"Expected 200, got {resp.status_code}")
        
        data = resp.json()
        subscribed = data.get("subscribed")
        devices = data.get("devices", 0)
        
        if not subscribed:
            return log_test(3, "Push status check", False, 
                          f"subscribed is {subscribed}, expected true")
        
        if devices < 1:
            return log_test(3, "Push status check", False, 
                          f"devices is {devices}, expected >= 1")
        
        return log_test(3, "Push status check", True, 
                       f"subscribed={subscribed}, devices={devices}")
    
    except Exception as e:
        return log_test(3, "Push status check", False, str(e))


def test_4_subscribe_upsert(token: str):
    """TEST 4: POST /api/push/subscribe AGAIN with same endpoint (upsert test)"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Subscribe again with same endpoint
        resp = requests.post(
            f"{API_BASE}/push/subscribe",
            json=FAKE_SUBSCRIPTION,
            headers=headers,
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_test(4, "Subscribe upsert (no duplicate)", False, 
                          f"Expected 200, got {resp.status_code}")
        
        # Check status - devices should still be 1 (not duplicated)
        status_resp = requests.get(
            f"{API_BASE}/push/status",
            headers=headers,
            timeout=10
        )
        
        if status_resp.status_code != 200:
            return log_test(4, "Subscribe upsert (no duplicate)", False, 
                          f"Status check failed: {status_resp.status_code}")
        
        status_data = status_resp.json()
        devices = status_data.get("devices", 0)
        
        if devices != 1:
            return log_test(4, "Subscribe upsert (no duplicate)", False, 
                          f"devices is {devices}, expected 1 (no duplicate)")
        
        return log_test(4, "Subscribe upsert (no duplicate)", True, 
                       f"Upsert successful, devices={devices}")
    
    except Exception as e:
        return log_test(4, "Subscribe upsert (no duplicate)", False, str(e))


def test_5_send_test_push(token: str):
    """TEST 5: POST /api/push/test - must return 200 with result object"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(
            f"{API_BASE}/push/test",
            headers=headers,
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_test(5, "Send test push", False, 
                          f"Expected 200, got {resp.status_code} - {resp.text}")
        
        data = resp.json()
        result = data.get("result")
        
        if result is None:
            return log_test(5, "Send test push", False, 
                          "No 'result' object in response")
        
        # Note: actual delivery to fake endpoint WILL fail, so result.sent may be 0
        # and result.failed >= 1 - this is EXPECTED and acceptable
        sent = result.get("sent", 0)
        failed = result.get("failed", 0)
        
        return log_test(5, "Send test push", True, 
                       f"Test push sent (sent={sent}, failed={failed} - delivery failure expected for fake endpoint)")
    
    except Exception as e:
        return log_test(5, "Send test push", False, str(e))


def test_6_create_announcement(token: str):
    """TEST 6: POST /api/admin/announcements - must succeed even if push fails"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        announcement_payload = {
            "title": "Tes Push",
            "body": "Halo semua",
            "target_roles": ["all"],
            "is_active": True
        }
        
        resp = requests.post(
            f"{API_BASE}/admin/announcements",
            json=announcement_payload,
            headers=headers,
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_test(6, "Create announcement with push", False, 
                          f"Expected 200, got {resp.status_code} - {resp.text}")
        
        data = resp.json()
        ann_id = data.get("id")
        title = data.get("title")
        
        if not ann_id:
            return log_test(6, "Create announcement with push", False, 
                          "No announcement ID in response")
        
        return log_test(6, "Create announcement with push", True, 
                       f"Announcement created: id={ann_id}, title={title}")
    
    except Exception as e:
        return log_test(6, "Create announcement with push", False, str(e))


def test_7_unsubscribe(token: str):
    """TEST 7: POST /api/push/unsubscribe - then verify status shows subscribed=false"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        unsubscribe_payload = {
            "endpoint": FAKE_SUBSCRIPTION["subscription"]["endpoint"]
        }
        
        resp = requests.post(
            f"{API_BASE}/push/unsubscribe",
            json=unsubscribe_payload,
            headers=headers,
            timeout=10
        )
        
        if resp.status_code != 200:
            return log_test(7, "Unsubscribe from push", False, 
                          f"Expected 200, got {resp.status_code}")
        
        # Check status - should show subscribed=false
        status_resp = requests.get(
            f"{API_BASE}/push/status",
            headers=headers,
            timeout=10
        )
        
        if status_resp.status_code != 200:
            return log_test(7, "Unsubscribe from push", False, 
                          f"Status check failed: {status_resp.status_code}")
        
        status_data = status_resp.json()
        subscribed = status_data.get("subscribed")
        
        if subscribed:
            return log_test(7, "Unsubscribe from push", False, 
                          f"subscribed is {subscribed}, expected false")
        
        return log_test(7, "Unsubscribe from push", True, 
                       f"Unsubscribed successfully, subscribed={subscribed}")
    
    except Exception as e:
        return log_test(7, "Unsubscribe from push", False, str(e))


def test_8_invalid_subscription(token: str):
    """TEST 8: POST /api/push/subscribe with invalid body - expect 400"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        invalid_payload = {
            "subscription": {
                "endpoint": "https://x",
                "keys": {}  # Missing required keys
            }
        }
        
        resp = requests.post(
            f"{API_BASE}/push/subscribe",
            json=invalid_payload,
            headers=headers,
            timeout=10
        )
        
        if resp.status_code != 400:
            return log_test(8, "Invalid subscription (expect 400)", False, 
                          f"Expected 400, got {resp.status_code}")
        
        return log_test(8, "Invalid subscription (expect 400)", True, 
                       f"Correctly rejected with 400")
    
    except Exception as e:
        return log_test(8, "Invalid subscription (expect 400)", False, str(e))


def test_health_check():
    """Verify backend health"""
    try:
        resp = requests.get(f"{API_BASE}/health", timeout=10)
        if resp.status_code == 200:
            print("✓ Backend health check: OK")
            return True
        else:
            print(f"✗ Backend health check: {resp.status_code}")
            return False
    except Exception as e:
        print(f"✗ Backend health check failed: {e}")
        return False


def main():
    """Run all tests"""
    print("=" * 70)
    print("FASE 2 WEB PUSH (VAPID) BACKEND TEST SUITE")
    print("Super Apps MATSANDATAMA - MTsN 2 Kota Malang")
    print("=" * 70)
    print(f"Backend URL: {API_BASE}")
    print()
    
    # Health check
    print("Preliminary checks:")
    if not test_health_check():
        print("\n✗ Backend is not healthy. Aborting tests.")
        sys.exit(1)
    print()
    
    # TEST 1: No auth required
    print("Running tests:")
    test_1_vapid_public_key()
    print()
    
    # Get auth token for remaining tests
    print("Authenticating as admin...")
    token, auth_msg = get_auth_token()
    if not token:
        print(f"✗ Authentication failed: {auth_msg}")
        print("Cannot proceed with authenticated tests.")
        sys.exit(1)
    print(f"✓ {auth_msg}")
    print()
    
    # Run authenticated tests
    test_2_subscribe(token)
    print()
    
    test_3_push_status(token)
    print()
    
    test_4_subscribe_upsert(token)
    print()
    
    test_5_send_test_push(token)
    print()
    
    test_6_create_announcement(token)
    print()
    
    test_7_unsubscribe(token)
    print()
    
    test_8_invalid_subscription(token)
    print()
    
    # Summary
    print("=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, p, _, _ in test_results if p)
    total = len(test_results)
    
    for num, passed_flag, name, details in test_results:
        status = "✓ PASS" if passed_flag else "✗ FAIL"
        print(f"TEST {num}: {status} - {name}")
    
    print()
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✓ ALL TESTS PASSED - Web Push backend is working correctly")
        sys.exit(0)
    else:
        print(f"✗ {total - passed} test(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
