"""
Script untuk mengecek data yang sudah diseeded di MongoDB Atlas
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_data():
    # MongoDB Atlas connection
    MONGO_URL = "mongodb+srv://kamaludinzuhri_db_user:Mtsn2kotamalang*@cluster0.qougudd.mongodb.net/"
    DB_NAME = "super_app_madrasah"

    print("Connecting to MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]

    try:
        # Test connection
        await client.admin.command('ping')
        print("SUCCESS! Connected to MongoDB Atlas\n")
        print("="*60)
        print("CHECKING SEEDED DATA")
        print("="*60)

        # Check collections
        collections_to_check = [
            ('settings', 'Settings'),
            ('academic_years', 'Academic Years'),
            ('semesters', 'Semesters'),
            ('users', 'Users'),
            ('students', 'Students'),
            ('student_profiles', 'Student Profiles'),
            ('classes', 'Classes'),
            ('rooms', 'Rooms'),
            ('subjects', 'Subjects'),
            ('schedules', 'Schedules'),
            ('holidays', 'Holidays'),
            ('rkam_budget_items', 'RKAM Budget Items'),
            ('rkam_documents', 'RKAM Documents'),
            ('achievements', 'Achievements'),
            ('announcements', 'Announcements'),
            ('tatib_categories', 'Tata Tertib Categories'),
            ('tatib_violations', 'Tata Tertib Violations'),
            ('mutations', 'Mutations'),
            ('attendance', 'Attendance'),
            ('journals', 'Journals'),
        ]

        for coll_name, display_name in collections_to_check:
            count = await db[coll_name].count_documents({})
            print(f"{display_name:30} : {count:5} documents")

        print("="*60)

        # Show sample RKAM data
        print("\nSample RKAM Budget Items:")
        print("-"*60)
        rkam_items = await db.rkam_budget_items.find({'fiscal_year': '2025/2026'}).limit(5).to_list(5)
        for item in rkam_items:
            print(f"  - {item.get('code')}: {item.get('description')}")
            print(f"    Sumber Dana: {item.get('sumber_dana')}, Bidang: {item.get('bidang')}")
            print(f"    Allocated: Rp {item.get('allocated_amount', 0):,.0f}")
            print(f"    Realized: Rp {item.get('realized_amount', 0):,.0f}")
            print()

        # Show sample Students
        print("\nSample Students:")
        print("-"*60)
        students = await db.students.find({}).limit(5).to_list(5)
        for student in students:
            print(f"  - {student.get('name')} (NISN: {student.get('nisn')})")
            print(f"    Class: {student.get('class_name')}, Gender: {student.get('gender')}")
            print()

        # Show sample Users
        print("\nSample Users:")
        print("-"*60)
        users = await db.users.find({}).limit(5).to_list(5)
        for user in users:
            print(f"  - {user.get('name')} ({user.get('username')})")
            print(f"    Role: {user.get('role')}, Email: {user.get('email')}")
            print()

        print("="*60)
        print("Data check completed!")
        print("="*60)

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_data())
