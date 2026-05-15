"""
Generate a test QR code for scanning in the frontend.
This creates a simple QR code with test data that can be printed or displayed on screen.
"""
import qrcode
import json
from datetime import datetime
from cryptography.fernet import Fernet

# Generate a simple test token (in real app this comes from room data)
test_payload = {
    "school_id": "mtsn2malang",
    "room_id": "test-room-001",
    "timestamp": datetime.now().isoformat()
}

# For testing, we'll create a simple QR with JSON data
# In production, this would be encrypted using the school's secret key
qr_data = json.dumps(test_payload)

# Generate QR code
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
)
qr.add_data(qr_data)
qr.make(fit=True)

# Create image
img = qr.make_image(fill_color="black", back_color="white")

# Save to file
img.save('test_qr_code.png')

print("[OK] Test QR code generated and saved to: test_qr_code.png")
print(f"[INFO] QR Data: {qr_data}")
print("[INFO] You can print this QR code or display it on another screen to test scanning")
print("\n[NOTE] This is a simplified test QR. In production, the QR contains encrypted data.")
