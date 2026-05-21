"""
Migration script to populate semester_id for existing classes.
Run this once to migrate old data to new semester-based system.
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Force UTF-8 output for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def migrate():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']

    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
    db = client[db_name]

    print("=" * 60)
    print("MIGRATION: Populate semester_id for existing classes")
    print("=" * 60)

    # Get all classes without semester_id
    classes_to_update = await db.classes.find(
        {'$or': [{'semester_id': None}, {'semester_id': {'$exists': False}}]},
        {'_id': 0}
    ).to_list(500)

    if not classes_to_update:
        print("\n✓ All classes already have semester_id. No migration needed.")
        return

    print(f"\nFound {len(classes_to_update)} classes without semester_id")

    # Get all semesters for matching
    all_semesters = await db.semesters.find({}, {'_id': 0}).to_list(500)
    print(f"Found {len(all_semesters)} semesters in database")

    updated_count = 0
    failed = []

    print("\nProcessing classes...")
    for cls in classes_to_update:
        academic_year_id = cls.get('academic_year_id')
        semester_str = cls.get('semester', '').lower()  # 'ganjil' or 'genap'
        class_name = cls.get('name', cls['id'])

        if not academic_year_id or not semester_str:
            failed.append({
                'class_id': cls['id'],
                'name': class_name,
                'reason': 'Missing academic_year_id or semester'
            })
            print(f"  ✗ {class_name}: Missing required fields")
            continue

        # Find matching semester
        matching_semester = None
        for sem in all_semesters:
            if (sem.get('academic_year_id') == academic_year_id and
                sem.get('code', '').lower() == semester_str):
                matching_semester = sem
                break

        if matching_semester:
            # Update class with semester_id
            await db.classes.update_one(
                {'id': cls['id']},
                {'$set': {'semester_id': matching_semester['id']}}
            )
            updated_count += 1
            print(f"  ✓ {class_name}: Linked to semester '{matching_semester.get('name')}'")
        else:
            failed.append({
                'class_id': cls['id'],
                'name': class_name,
                'reason': f"No semester found for AY {academic_year_id} / {semester_str}"
            })
            print(f"  ✗ {class_name}: No matching semester found")

    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print(f"✓ Successfully updated: {updated_count} classes")
    print(f"✗ Failed: {len(failed)} classes")

    if failed:
        print("\nFailed classes:")
        for f in failed:
            print(f"  - {f['name']} ({f['class_id']}): {f['reason']}")

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
