"""Test script for bulk QR generation endpoint"""
import requests

# Login as admin
login_resp = requests.post(
    'http://localhost:8000/api/auth/login',
    json={
        'username': 'admin',
        'password': 'admin123',
        'captcha': 'test'  # Will fail but let's try
    }
)

print(f"Login response: {login_resp.status_code}")
print(f"Login body: {login_resp.text[:200]}")

if login_resp.status_code == 200:
    token = login_resp.json()['access_token']
    print(f"\n✓ Got token: {token[:30]}...")

    # Try bulk generation
    bulk_resp = requests.post(
        'http://localhost:8000/api/qr-cards/bulk-by-grade',
        headers={'Authorization': f'Bearer {token}'},
        data={'grade': '7'}
    )

    print(f"\nBulk endpoint response: {bulk_resp.status_code}")
    if bulk_resp.status_code != 200:
        print(f"Error: {bulk_resp.text}")
    else:
        print(f"Success! Content-Type: {bulk_resp.headers.get('content-type')}")
        print(f"Content length: {len(bulk_resp.content)} bytes")
else:
    print("\n✗ Login failed, trying without auth...")
    # Try accessing endpoint without auth to see error
    bulk_resp = requests.post(
        'http://localhost:8000/api/qr-cards/bulk-by-grade',
        data={'grade': '7'}
    )
    print(f"Bulk endpoint response (no auth): {bulk_resp.status_code}")
    print(f"Response: {bulk_resp.text}")
