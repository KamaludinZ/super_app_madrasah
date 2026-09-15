"""
Script untuk generate token untuk semua kelas.
Jalankan dengan: python backend/generate_kelas_tokens.py
"""
import asyncio
import os
import random
import string
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=True)

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')

if not MONGO_URL:
    raise ValueError("MONGO_URL not found in environment variables")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def generate_token(class_name: str, year: str = "2025") -> str:
    """Generate secure token untuk kelas."""
    # Random 6 karakter uppercase alphanumeric
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{class_name}-{year}-{random_part}"


async def generate_tokens_for_all_classes():
    """Generate token untuk semua kelas yang belum punya token."""

    print("=" * 60)
    print("GENERATE TOKEN KELAS DIGITAL")
    print("=" * 60)
    print()

    # Get all classes
    classes = await db.classes.find({}).to_list(None)

    if not classes:
        print("❌ Tidak ada kelas ditemukan di database")
        return

    print(f"📚 Ditemukan {len(classes)} kelas")
    print()

    updated_count = 0
    skipped_count = 0

    for kelas in classes:
        class_id = kelas.get('id')
        class_name = kelas.get('name', 'Unknown')
        existing_token = kelas.get('token')

        # Skip jika sudah punya token
        if existing_token:
            print(f"⏭️  {class_name:15} - Sudah punya token: {existing_token}")
            skipped_count += 1
            continue

        # Generate token baru
        # Try to get year from academic_year_id or semester_id
        year = "2025"
        if kelas.get('academic_year_id'):
            try:
                academic_year = await db.academic_years.find_one({'id': kelas.get('academic_year_id')})
                if academic_year and academic_year.get('name'):
                    # Extract year from name like "2024/2025"
                    year_parts = academic_year['name'].split('/')
                    if year_parts:
                        year = year_parts[0]
            except Exception:
                pass

        token = generate_token(class_name, year)

        # Update database
        await db.classes.update_one(
            {'id': class_id},
            {'$set': {
                'token': token,
                'token_generated_at': datetime.utcnow()
            }}
        )

        print(f"✅ {class_name:15} → Token: {token}")
        updated_count += 1

    print()
    print("=" * 60)
    print(f"✅ Selesai!")
    print(f"   - Token baru dibuat: {updated_count}")
    print(f"   - Sudah punya token: {skipped_count}")
    print(f"   - Total kelas: {len(classes)}")
    print("=" * 60)


async def regenerate_all_tokens():
    """Regenerate semua token (HATI-HATI: akan replace token lama!)"""

    print("=" * 60)
    print("⚠️  REGENERATE SEMUA TOKEN KELAS")
    print("=" * 60)
    print()
    print("PERINGATAN: Ini akan mengganti SEMUA token yang ada!")
    print("Token lama tidak akan bisa digunakan lagi.")
    print()

    confirm = input("Ketik 'YES' untuk melanjutkan: ")

    if confirm != 'YES':
        print("❌ Dibatalkan")
        return

    print()

    # Get all classes
    classes = await db.classes.find({}).to_list(None)

    if not classes:
        print("❌ Tidak ada kelas ditemukan di database")
        return

    print(f"📚 Akan regenerate token untuk {len(classes)} kelas")
    print()

    for kelas in classes:
        class_id = kelas.get('id')
        class_name = kelas.get('name', 'Unknown')
        old_token = kelas.get('token', '-')

        # Get year
        year = "2025"
        if kelas.get('academic_year_id'):
            try:
                academic_year = await db.academic_years.find_one({'id': kelas.get('academic_year_id')})
                if academic_year and academic_year.get('name'):
                    year_parts = academic_year['name'].split('/')
                    if year_parts:
                        year = year_parts[0]
            except Exception:
                pass

        token = generate_token(class_name, year)

        # Update database
        await db.classes.update_one(
            {'id': class_id},
            {'$set': {
                'token': token,
                'token_generated_at': datetime.utcnow(),
                'previous_token': old_token
            }}
        )

        print(f"✅ {class_name:15}")
        print(f"   Token lama: {old_token}")
        print(f"   Token baru: {token}")
        print()

    print("=" * 60)
    print(f"✅ Selesai regenerate {len(classes)} token!")
    print("=" * 60)


async def show_all_tokens():
    """Tampilkan semua token kelas yang ada."""

    print("=" * 60)
    print("DAFTAR TOKEN KELAS DIGITAL")
    print("=" * 60)
    print()

    # Get all classes with token
    classes = await db.classes.find({}).sort('name', 1).to_list(None)

    if not classes:
        print("❌ Tidak ada kelas ditemukan di database")
        return

    print(f"{'Nama Kelas':<20} {'Token':<25} {'Status'}")
    print("-" * 60)

    with_token = 0
    without_token = 0

    for kelas in classes:
        class_name = kelas.get('name', 'Unknown')
        token = kelas.get('token')

        if token:
            status = "✅ Ada"
            with_token += 1
        else:
            token = "-"
            status = "❌ Belum"
            without_token += 1

        print(f"{class_name:<20} {token:<25} {status}")

    print()
    print("=" * 60)
    print(f"Total: {len(classes)} kelas")
    print(f"Dengan token: {with_token}")
    print(f"Tanpa token: {without_token}")
    print("=" * 60)


async def main():
    """Main menu."""

    while True:
        print()
        print("=" * 60)
        print("KELAS DIGITAL - TOKEN GENERATOR")
        print("=" * 60)
        print()
        print("Pilih menu:")
        print("1. Generate token untuk kelas yang belum punya (recommended)")
        print("2. Regenerate SEMUA token (hati-hati!)")
        print("3. Tampilkan semua token")
        print("4. Keluar")
        print()

        choice = input("Pilih (1-4): ")
        print()

        if choice == '1':
            await generate_tokens_for_all_classes()
        elif choice == '2':
            await regenerate_all_tokens()
        elif choice == '3':
            await show_all_tokens()
        elif choice == '4':
            print("👋 Selesai")
            break
        else:
            print("❌ Pilihan tidak valid")

    # Close connection
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
