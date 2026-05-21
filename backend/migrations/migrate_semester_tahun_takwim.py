"""
Migration: Add tahun_takwim_id to existing semesters

This script will:
1. Find all semesters without tahun_takwim_id
2. For each semester, get its academic year
3. Assign tahun_takwim_id based on semester code:
   - Ganjil/odd semesters (ganjil, 1, 3, 5) → first year of academic year
   - Genap/even semesters (genap, 2, 4, 6) → second year of academic year
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import core
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate():
    """Run migration to add tahun_takwim_id to semesters."""
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print(">>> Starting migration: Add tahun_takwim_id to semesters\n")

    # Get all semesters without tahun_takwim_id
    semesters = await db.semesters.find({'tahun_takwim_id': {'$exists': False}}).to_list(500)

    if not semesters:
        print("[OK] No semesters need migration. All semesters already have tahun_takwim_id.")
        return

    print(f"[INFO] Found {len(semesters)} semesters without tahun_takwim_id\n")

    updated_count = 0
    skipped_count = 0

    for sem in semesters:
        sem_id = sem.get('id')
        sem_name = sem.get('name')
        sem_code = sem.get('code', '').lower()
        ay_id = sem.get('academic_year_id')

        print(f"Processing: {sem_name} (code: {sem_code})")

        # Get academic year
        ay = await db.academic_years.find_one({'id': ay_id})
        if not ay:
            print(f"  [SKIP] Academic year {ay_id} not found")
            skipped_count += 1
            continue

        ay_name = ay.get('name', '')
        tahun_takwim_ids = ay.get('tahun_takwim_ids', [])

        if not tahun_takwim_ids or len(tahun_takwim_ids) < 2:
            print(f"  [SKIP] Academic year {ay_name} doesn't have 2 Tahun Takwim")
            skipped_count += 1
            continue

        # Sort to ensure first year is earlier
        tahun_takwim_ids.sort()

        # Determine which Tahun Takwim based on semester code
        # Ganjil/odd → first year, Genap/even → second year
        odd_codes = ['ganjil', '1', '3', '5']
        even_codes = ['genap', '2', '4', '6']

        if sem_code in odd_codes:
            tahun_takwim_id = tahun_takwim_ids[0]  # First year (e.g., 2025)
            print(f"  → Assigning Tahun Takwim: {tahun_takwim_ids[0]} (first year - odd semester)")
        elif sem_code in even_codes:
            tahun_takwim_id = tahun_takwim_ids[1] if len(tahun_takwim_ids) > 1 else tahun_takwim_ids[0]
            print(f"  → Assigning Tahun Takwim: {tahun_takwim_id} (second year - even semester)")
        else:
            # Unknown code, assign first year as default
            tahun_takwim_id = tahun_takwim_ids[0]
            print(f"  [WARN] Unknown code '{sem_code}', using first year: {tahun_takwim_ids[0]}")

        # Update semester
        result = await db.semesters.update_one(
            {'id': sem_id},
            {'$set': {'tahun_takwim_id': tahun_takwim_id}}
        )

        if result.modified_count > 0:
            print(f"  [OK] Updated successfully")
            updated_count += 1
        else:
            print(f"  [WARN] No changes made")

        print()

    print(f"\n{'='*60}")
    print(f"Migration completed!")
    print(f"  [OK] Updated: {updated_count} semesters")
    print(f"  [SKIP] Skipped: {skipped_count} semesters")
    print(f"{'='*60}\n")

    client.close()


if __name__ == '__main__':
    asyncio.run(migrate())
