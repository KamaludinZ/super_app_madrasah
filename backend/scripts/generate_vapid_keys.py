"""Generate VAPID keys for web push notifications."""
from py_vapid import Vapid
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
import base64

v = Vapid()
v.generate_keys()

# Export public key in uncompressed format (required for Web Push)
# Get the raw public key bytes (65 bytes for P-256)
public_key_bytes = v.public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)
public_key_b64 = base64.urlsafe_b64encode(public_key_bytes).decode('utf-8').rstrip('=')

# Export private key as PEM
private_key_pem = v.private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
).decode('utf-8')

# For .env file, we need to escape newlines
private_key_env = private_key_pem.replace('\n', '\\n')

print("=" * 70)
print("VAPID Keys Generated Successfully!")
print("=" * 70)
print()
print("Add these to your backend/.env file:")
print()
print(f'VAPID_PUBLIC_KEY={public_key_b64}')
print()
print(f'VAPID_PRIVATE_KEY={private_key_env}')
print()
print(f'VAPID_SUBJECT=mailto:admin@super-app-madrasah.example.com')
print()
print("=" * 70)
print("Note: Keep the private key secret! Do not commit to git.")
print("=" * 70)
