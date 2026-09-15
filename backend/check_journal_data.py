"""
Quick script to check if journals have attendance data
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def check_journals():
    # Connect to MongoDB
    mongo_url = os.getenv('MONGODB_URL')
    print(f"Connecting to MongoDB...")

    client = AsyncIOMotorClient(mongo_url)
    db = client['super_app_madrasah']

    try:
        # Test connection
        await db.command('ping')
        print("Connected successfully!")

        # Count total journals
        total_journals = await db.journals.count_documents({})
        print(f"\nTotal journals in database: {total_journals}")

        # Get a sample journal
        sample = await db.journals.find_one({}, {'_id': 0})
        if sample:
            print(f"\nSample journal ID: {sample.get('id')}")
            print(f"Class ID: {sample.get('class_id')}")
            print(f"Subject ID: {sample.get('subject_id')}")
            print(f"Siswa hadir: {sample.get('siswa_hadir')}")
            print(f"Siswa sakit: {sample.get('siswa_sakit')}")
            print(f"Siswa izin: {sample.get('siswa_izin')}")
            print(f"Siswa alpha: {sample.get('siswa_tidak_hadir')}")
            print(f"Has attendance_details field: {'attendance_details' in sample}")
            if 'attendance_details' in sample:
                print(f"Attendance details count: {len(sample.get('attendance_details', []))}")

        # Count attendance records
        total_attendance = await db.attendances.count_documents({})
        print(f"\nTotal attendance records: {total_attendance}")

        # Get sample attendance
        sample_att = await db.attendances.find_one({}, {'_id': 0})
        if sample_att:
            print(f"\nSample attendance record:")
            print(f"  Journal ID: {sample_att.get('journal_id')}")
            print(f"  Student ID: {sample_att.get('student_id')}")
            print(f"  Student Name: {sample_att.get('student_name')}")
            print(f"  Status: {sample_att.get('status')}")

        # Check if any journal has attendance records
        if sample:
            journal_id = sample.get('id')
            att_for_journal = await db.attendances.count_documents({'journal_id': journal_id})
            print(f"\nAttendance records for sample journal: {att_for_journal}")

    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_journals())
