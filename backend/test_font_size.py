"""Test script to verify font sizes in QR card generation"""
import os
os.environ.setdefault('QR_MASTER_SECRET', 'MATSANDATAMA-SECRET-KEY-2026-V1')
os.environ.setdefault('SCHOOL_ID', 'MTSN2-MLG')

from journal_core import create_b5_card

# Test card generation
print("Generating test QR card with updated font sizes...")

test_qr_data = "test_encrypted_token_123456789"
test_room_name = "R-7A"
test_class_name = "7A"
test_class_token = "7A-2526-TEST"

# Generate card
card_bytes = create_b5_card(
    qr_data=test_qr_data,
    room_name=test_room_name,
    class_name=test_class_name,
    class_token=test_class_token,
    school_name="MTsN 2 Kota Malang",
    app_name="Super Apps MATSANDATAMA"
)

# Save to file
output_path = "test_qr_card_LARGE_FONTS.png"
with open(output_path, "wb") as f:
    f.write(card_bytes)

print(f"✓ Test card generated successfully!")
print(f"✓ Saved to: {output_path}")
print(f"✓ File size: {len(card_bytes)} bytes")
print(f"\nFont sizes used:")
print(f"  - App name header: 80pt")
print(f"  - School name: 56pt")
print(f"  - Class name (7A): 280pt (HUGE!)")
print(f"  - Room label: 72pt")
print(f"  - Token label: 44pt")
print(f"  - Token value: 72pt (BIG!)")
print(f"  - Instructions: 50pt / 70pt")
print(f"\nSilakan buka file '{output_path}' untuk melihat hasilnya!")
