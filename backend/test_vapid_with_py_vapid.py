"""
Test VAPID key using py_vapid library directly
"""

import os
from dotenv import load_dotenv
from py_vapid import Vapid

load_dotenv()

def get_vapid_private_key():
    raw = os.environ.get("VAPID_PRIVATE_KEY", "")
    if not raw:
        return None
    return raw.replace("\\n", "\n")

print('='*60)
print('TESTING VAPID KEY WITH PY_VAPID')
print('='*60)
print()

private_key_pem = get_vapid_private_key()

print(f'Private key PEM (first 100 chars):')
print(private_key_pem[:100])
print()

print('Attempting to load key into Vapid object...')
print()

try:
    vapid = Vapid()

    # Try to load from PEM string
    vapid.from_pem(private_key_pem.encode('utf-8'))

    print('[SUCCESS] Key loaded successfully!')
    print()

    # Try to sign something
    print('Attempting to sign a test message...')
    claims = {"sub": "mailto:test@example.com", "aud": "https://fcm.googleapis.com"}

    headers = vapid.sign(claims)
    print(f'[SUCCESS] Signed successfully!')
    print(f'Authorization header: {headers.get("Authorization", "")[:50]}...')
    print()

except Exception as e:
    print(f'[FAILED] Error: {e}')
    print()

    import traceback
    traceback.print_exc()

print('='*60)
