"""
Test if VAPID keys are valid
"""

import os
from dotenv import load_dotenv

load_dotenv()

def get_vapid_private_key():
    raw = os.environ.get("VAPID_PRIVATE_KEY", "")
    if not raw:
        return None
    return raw.replace("\\n", "\n")

def get_vapid_public_key():
    return os.environ.get("VAPID_PUBLIC_KEY", "")

print('='*60)
print('VAPID KEY VALIDITY TEST')
print('='*60)
print()

private_key = get_vapid_private_key()
public_key = get_vapid_public_key()

print(f'Private key length: {len(private_key)}')
print(f'Public key length: {len(public_key)}')
print()

print('Private key (first 5 lines):')
for line in private_key.split('\n')[:5]:
    print(f'  {line}')
print()

print('Public key:')
print(f'  {public_key}')
print()

# Try to use the key with pywebpush
print('Testing key with pywebpush...')
print()

try:
    from pywebpush import webpush

    # Create a dummy subscription to test
    test_subscription = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/test",
        "keys": {
            "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
            "auth": "tBHItJI5svbpez7KI4CCXg=="
        }
    }

    print('Attempting to create VAPID claims...')
    claims = {"sub": "mailto:test@example.com"}
    print(f'  Claims: {claims}')
    print()

    # The error happens when webpush tries to parse the private key
    print('Attempting to send (will fail at endpoint, but should parse key)...')
    result = webpush(
        subscription_info=test_subscription,
        data="test",
        vapid_private_key=private_key,
        vapid_claims=claims,
        ttl=0
    )
    print('  Unexpectedly succeeded!')

except Exception as e:
    error_msg = str(e)
    print(f'Error: {error_msg}')
    print()

    if 'Could not deserialize key data' in error_msg:
        print('KEY FORMAT ERROR detected!')
        print()
        print('Possible causes:')
        print('  1. Private key is not in correct PEM format')
        print('  2. Key algorithm is not supported')
        print('  3. Key is corrupted or truncated')
        print()

        # Check if key ends properly
        print('Checking key structure...')
        if private_key.startswith('-----BEGIN PRIVATE KEY-----'):
            print('  [OK] Key starts with BEGIN marker')
        else:
            print('  [ERROR] Key does NOT start with BEGIN marker')

        if private_key.endswith('-----END PRIVATE KEY-----\n') or private_key.endswith('-----END PRIVATE KEY-----'):
            print('  [OK] Key ends with END marker')
        else:
            print(f'  [ERROR] Key does NOT end properly')
            print(f'  Last 50 chars: {repr(private_key[-50:])}')

        lines = private_key.split('\n')
        print(f'  Key has {len(lines)} lines')

        # Check for common issues
        base64_content = ''.join(lines[1:-1])
        print(f'  Base64 content length: {len(base64_content)}')
        print(f'  Base64 content (first 50): {base64_content[:50]}')
        print(f'  Base64 content (last 50): {base64_content[-50:]}')

    elif 'endpoint' in error_msg.lower() or 'connection' in error_msg.lower():
        print('KEY IS VALID!')
        print('  (Error is from connection/endpoint, not key parsing)')
    else:
        print(f'Unknown error: {error_msg}')

print()
print('='*60)
