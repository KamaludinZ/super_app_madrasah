"""
Test pywebpush with PEM file directly
"""

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from pywebpush import webpush
import base64

# Generate key
private_key = ec.generate_private_key(ec.SECP256R1())

# Export as PEM
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

print('Private PEM (bytes):')
print(private_pem)
print()

# Test subscription
test_subscription = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/test",
    "keys": {
        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
        "auth": "tBHItJI5svbpez7KI4CCXg=="
    }
}

claims = {"sub": "mailto:test@example.com"}

print('Testing with BYTES (not decoded):')
try:
    result = webpush(
        subscription_info=test_subscription,
        data="test",
        vapid_private_key=private_pem,  # BYTES, not string
        vapid_claims=claims,
        ttl=0
    )
    print('[SUCCESS] Worked with bytes!')
except Exception as e:
    if 'Could not deserialize' in str(e):
        print(f'[FAILED] Still error: {str(e)[:100]}...')
    else:
        print(f'[MAYBE SUCCESS] Different error (network?): {str(e)[:100]}...')

print()
print('Testing with STRING (decoded):')
try:
    result = webpush(
        subscription_info=test_subscription,
        data="test",
        vapid_private_key=private_pem.decode('utf-8'),  # STRING
        vapid_claims=claims,
        ttl=0
    )
    print('[SUCCESS] Worked with string!')
except Exception as e:
    if 'Could not deserialize' in str(e):
        print(f'[FAILED] Still error: {str(e)[:100]}...')
    else:
        print(f'[MAYBE SUCCESS] Different error (network?): {str(e)[:100]}...')

