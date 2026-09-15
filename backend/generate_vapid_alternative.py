"""
Generate VAPID keys using alternative method
Based on pywebpush documentation
"""

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

# Generate EC key pair (P-256 curve)
private_key = ec.generate_private_key(ec.SECP256R1())

# Get public key
public_key = private_key.public_key()

# Export private key as PEM (PKCS8 format)
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
).decode('utf-8')

# Export public key in uncompressed X9.62 format (65 bytes for P-256)
public_bytes = public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)

# Base64url encode (keep padding)
public_b64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8')

# For .env, escape newlines
private_env = private_pem.replace('\n', '\\n')

print('='*70)
print('ALTERNATIVE VAPID KEY GENERATION')
print('='*70)
print()

print('Private key (PEM format):')
print(private_pem)
print()

print('Public key (base64url):')
print(public_b64)
print()

print('='*70)
print('FOR .ENV FILE:')
print('='*70)
print()
print(f'VAPID_PUBLIC_KEY={public_b64}')
print()
print(f'VAPID_PRIVATE_KEY={private_env}')
print()
print(f'VAPID_SUBJECT=mailto:admyt.mtsn2kotamalang@gmail.com')
print()
print('='*70)

# Test the key immediately
print()
print('TESTING KEY VALIDITY...')
print()

try:
    from pywebpush import webpush

    test_subscription = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/test",
        "keys": {
            "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
            "auth": "tBHItJI5svbpez7KI4CCXg=="
        }
    }

    claims = {"sub": "mailto:test@example.com"}

    # This will fail at network level but should parse key successfully
    result = webpush(
        subscription_info=test_subscription,
        data="test",
        vapid_private_key=private_pem,
        vapid_claims=claims,
        ttl=0
    )

    print('[UNEXPECTED SUCCESS] Key worked!')

except Exception as e:
    error_msg = str(e)

    if 'Could not deserialize key data' in error_msg:
        print(f'[FAILED] Key format error: {error_msg}')
    elif 'endpoint' in error_msg.lower() or 'connection' in error_msg.lower() or 'FCM' in error_msg:
        print(f'[SUCCESS] Key is valid! (Error is from network/endpoint)')
        print(f'   Error: {error_msg[:100]}...')
    else:
        print(f'[UNKNOWN] {error_msg}')

print()
print('='*70)
