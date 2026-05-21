"""
Migration script to populate semester_id for existing attendance records.
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
    print("MIGRATION: Populate semester_id for existing attendance records")
    print("=" * 60)

    # Get all attendance records without semester_id
    attendance_to_update = await db.class_attendance.find(
        {'$or': [{'semester_id': None}, {'semester_id': {'$exists': False}}]},
        {'_id': 0}
    ).to_list(5000)

    if not attendance_to_update:
        print("\n✓ All attendance records already have semester_id. No migration needed.")
        client.close()
        return

    print(f"\nFound {len(attendance_to_update)} attendance records without semester_id")

    # Get all classes (to find semester_id from class)
    all_classes = await db.classes.find({}, {'_id': 0, 'id': 1, 'semester_id': 1, 'name': 1}).to_list(500)
    class_map = {c['id']: c for c in all_classes}

    # Get all semesters for fallback matching
    all_semesters = await db.semesters.find({}, {'_id': 0}).to_list(500)
    print(f"Found {len(all_semesters)} semesters in database")
    print(f"Found {len(all_classes)} classes in database")

    updated_count = 0
    failed = []

    print("\nProcessing attendance records...")
    for att in attendance_to_update:
        attendance_id = att['id']
        class_id = att.get('class_id')

        # Try to get semester_id from the class first
        semester_id = None
        if class_id and class_id in class_map:
            cls = class_map[class_id]
            semester_id = cls.get('semester_id')
            if semester_id:
                await db.class_attendance.update_one(
                    {'id': attendance_id},
                    {'$set': {'semester_id': semester_id}}
                )
                updated_count += 1
                print(f"  ✓ Attendance {attendance_id[:8]}: Linked to semester via class {cls.get('name')}")
                continue

        # Fallback: try to match using old fields (academic_year_id + semester string)
        academic_year_id = att.get('academic_year_id')
        semester_str = att.get('semester', '').lower()

        if academic_year_id and semester_str:
            # Find matching semester
            matching_semester = None
            for sem in all_semesters:
                if (sem.get('academic_year_id') == academic_year_id and
                    sem.get('code', '').lower() == semester_str):
                    matching_semester = sem
                    break

            if matching_semester:
                await db.class_attendance.update_one(
                    {'id': attendance_id},
                    {'$set': {'semester_id': matching_semester['id']}}
                )
                updated_count += 1
                print(f"  ✓ Attendance {attendance_id[:8]}: Linked to semester '{matching_semester.get('name')}' (fallback)")
            else:
                failed.append({
                    'attendance_id': attendance_id,
                    'class_id': class_id,
                    'date': att.get('date'),
                    'reason': f"No semester found for AY {academic_year_id} / {semester_str}"
                })
                print(f"  ✗ Attendance {attendance_id[:8]}: No matching semester found")
        else:
            failed.append({
                'attendance_id': attendance_id,
                'class_id': class_id,
                'date': att.get('date'),
                'reason': 'Missing required fields (class_id or academic_year_id/semester)'
            })
            print(f"  ✗ Attendance {attendance_id[:8]}: Missing required fields")

    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print(f"✓ Successfully updated: {updated_count} attendance records")
    print(f"✗ Failed: {len(failed)} records")

    if failed:
        print("\nFailed attendance records (first 10):")
        for f in failed[:10]:
            print(f"  - {f['attendance_id'][:8]} (class: {f.get('class_id', '-')[:8]}, date: {f.get('date')}): {f['reason']}")

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
