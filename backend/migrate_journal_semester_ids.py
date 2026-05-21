"""
Migration script to populate semester_id for existing journal records.
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
    print("MIGRATION: Populate semester_id for existing journal records")
    print("=" * 60)

    # Get all journal records without semester_id
    journals_to_update = await db.journals.find(
        {'$or': [{'semester_id': None}, {'semester_id': {'$exists': False}}]},
        {'_id': 0}
    ).to_list(10000)

    if not journals_to_update:
        print("\n✓ All journal records already have semester_id. No migration needed.")
        client.close()
        return

    print(f"\nFound {len(journals_to_update)} journal records without semester_id")

    # Get all schedules (to find semester_id from schedule)
    all_schedules = await db.schedules.find({}, {'_id': 0, 'id': 1, 'semester_id': 1}).to_list(5000)
    schedule_map = {s['id']: s for s in all_schedules}

    # Get all classes (as fallback)
    all_classes = await db.classes.find({}, {'_id': 0, 'id': 1, 'semester_id': 1, 'name': 1}).to_list(500)
    class_map = {c['id']: c for c in all_classes}

    # Get all semesters for final fallback matching
    all_semesters = await db.semesters.find({}, {'_id': 0}).to_list(500)
    print(f"Found {len(all_semesters)} semesters in database")
    print(f"Found {len(all_schedules)} schedules in database")
    print(f"Found {len(all_classes)} classes in database")

    updated_count = 0
    failed = []

    print("\nProcessing journal records...")
    for journal in journals_to_update:
        journal_id = journal['id']
        schedule_id = journal.get('schedule_id')
        class_id = journal.get('class_id')

        # Priority 1: Try to get semester_id from the schedule first
        semester_id = None
        if schedule_id and schedule_id in schedule_map:
            sch = schedule_map[schedule_id]
            semester_id = sch.get('semester_id')
            if semester_id:
                await db.journals.update_one(
                    {'id': journal_id},
                    {'$set': {'semester_id': semester_id}}
                )
                updated_count += 1
                print(f"  ✓ Journal {journal_id[:8]}: Linked to semester via schedule {schedule_id[:8]}")
                continue

        # Priority 2: Try to get semester_id from the class
        if class_id and class_id in class_map:
            cls = class_map[class_id]
            semester_id = cls.get('semester_id')
            if semester_id:
                await db.journals.update_one(
                    {'id': journal_id},
                    {'$set': {'semester_id': semester_id}}
                )
                updated_count += 1
                print(f"  ✓ Journal {journal_id[:8]}: Linked to semester via class {cls.get('name')}")
                continue

        # Fallback: try to match using old fields (academic_year_id + semester string)
        academic_year_id = journal.get('academic_year_id')
        semester_str = journal.get('semester', '').lower()

        if academic_year_id and semester_str:
            # Find matching semester
            matching_semester = None
            for sem in all_semesters:
                if (sem.get('academic_year_id') == academic_year_id and
                    sem.get('code', '').lower() == semester_str):
                    matching_semester = sem
                    break

            if matching_semester:
                await db.journals.update_one(
                    {'id': journal_id},
                    {'$set': {'semester_id': matching_semester['id']}}
                )
                updated_count += 1
                print(f"  ✓ Journal {journal_id[:8]}: Linked to semester '{matching_semester.get('name')}' (fallback)")
            else:
                failed.append({
                    'journal_id': journal_id,
                    'schedule_id': schedule_id,
                    'class_id': class_id,
                    'reason': f"No semester found for AY {academic_year_id} / {semester_str}"
                })
                print(f"  ✗ Journal {journal_id[:8]}: No matching semester found")
        else:
            failed.append({
                'journal_id': journal_id,
                'schedule_id': schedule_id,
                'class_id': class_id,
                'reason': 'Missing required fields (schedule_id, class_id, or academic_year_id/semester)'
            })
            print(f"  ✗ Journal {journal_id[:8]}: Missing required fields")

    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print(f"✓ Successfully updated: {updated_count} journal records")
    print(f"✗ Failed: {len(failed)} records")

    if failed:
        print("\nFailed journal records (first 10):")
        for f in failed[:10]:
            print(f"  - {f['journal_id'][:8]} (schedule: {f.get('schedule_id', '-')[:8]}, class: {f.get('class_id', '-')[:8]}): {f['reason']}")

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
