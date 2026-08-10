"""
Diagnostic script to check jabatan master data

This script will:
1. List all jabatan entries in the database
2. Check if any jabatan names match role names
3. Show which users are assigned to each jabatan
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

# Load environment
load_dotenv()
MONGO_URL = os.getenv('MONGO_URL')
if not MONGO_URL:
    print("❌ MONGO_URL not found in .env file!")
    exit(1)

# Extract DB name from URL or use env variable
DB_NAME = 'super_app_madrasah'

# Role names that should NOT appear in jabatan master data
ROLE_NAMES = [
    'Administrator',
    'Guru Mata Pelajaran',
    'Wali Kelas',
    'Guru BK',
    'Tenaga Kependidikan',
    'Kepala Sekolah',
    'Wakil Kepala Sekolah',
    'Siswa'
]

async def check_jabatan_data():
    """Check jabatan master data for issues"""

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("=" * 80)
    print("CHECKING JABATAN MASTER DATA")
    print("=" * 80)

    # Get all jabatan entries
    jabatan_list = await db.jabatan.find({}, {'_id': 0}).to_list(1000)

    print(f"\n📊 Total jabatan entries: {len(jabatan_list)}\n")

    if not jabatan_list:
        print("❌ No jabatan entries found in database!")
        print("   You need to create jabatan master data first.")
        client.close()
        return

    # Categorize jabatan
    role_based_jabatan = []
    proper_jabatan = []

    for jab in jabatan_list:
        name = jab.get('name', '')
        if name in ROLE_NAMES:
            role_based_jabatan.append(jab)
        else:
            proper_jabatan.append(jab)

    # Show role-based jabatan (PROBLEMS)
    if role_based_jabatan:
        print("🚨 PROBLEM: Found jabatan entries using ROLE NAMES")
        print("   These should be deleted or renamed to actual positions:")
        print()
        for jab in role_based_jabatan:
            print(f"   ❌ ID: {jab.get('id')}")
            print(f"      Name: {jab.get('name')}")
            print(f"      Description: {jab.get('description', '-')}")

            # Find users with this jabatan
            users = await db.users.find(
                {'jabatan_ids': jab.get('id')},
                {'_id': 0, 'full_name': 1, 'nip': 1}
            ).to_list(100)

            if users:
                print(f"      👥 Users assigned: {len(users)}")
                for user in users[:3]:  # Show first 3
                    print(f"         - {user.get('full_name')} ({user.get('nip', 'no NIP')})")
                if len(users) > 3:
                    print(f"         ... and {len(users) - 3} more")
            else:
                print(f"      👥 Users assigned: 0 (safe to delete)")

            print()
    else:
        print("✅ No jabatan entries using role names (GOOD!)")
        print()

    # Show proper jabatan
    if proper_jabatan:
        print(f"✅ Proper jabatan entries ({len(proper_jabatan)}):")
        print()
        for jab in proper_jabatan:
            print(f"   ✓ ID: {jab.get('id')}")
            print(f"     Name: {jab.get('name')}")
            print(f"     Description: {jab.get('description', '-')}")

            # Find users with this jabatan
            users = await db.users.find(
                {'jabatan_ids': jab.get('id')},
                {'_id': 0, 'full_name': 1, 'nip': 1}
            ).to_list(100)

            print(f"     👥 Users assigned: {len(users)}")
            if users:
                for user in users[:3]:
                    print(f"        - {user.get('full_name')} ({user.get('nip', 'no NIP')})")
                if len(users) > 3:
                    print(f"        ... and {len(users) - 3} more")
            print()

    # Show users WITHOUT jabatan
    print("\n" + "=" * 80)
    print("USERS WITHOUT JABATAN ASSIGNMENT")
    print("=" * 80)

    users_no_jabatan = await db.users.find(
        {
            '$or': [
                {'jabatan_ids': {'$exists': False}},
                {'jabatan_ids': []},
                {'jabatan_ids': None}
            ],
            'roles': {'$nin': ['siswa', 'admin']}  # Exclude siswa and admin
        },
        {'_id': 0, 'full_name': 1, 'nip': 1, 'roles': 1}
    ).to_list(100)

    if users_no_jabatan:
        print(f"\n⚠️  Found {len(users_no_jabatan)} users without jabatan:")
        print()
        for user in users_no_jabatan:
            print(f"   - {user.get('full_name')} ({user.get('nip', 'no NIP')})")
            print(f"     Roles: {', '.join(user.get('roles', []))}")
            print()
    else:
        print("\n✅ All users have jabatan assigned (or are siswa/admin)")

    # Recommendations
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)

    if role_based_jabatan:
        print("\n⚠️  ACTION REQUIRED:")
        print("   1. Go to admin panel → Jabatan menu")
        print("   2. Delete jabatan entries with role names (marked with ❌ above)")
        print("   3. Create proper jabatan entries like:")
        print("      - Kepala Madrasah")
        print("      - Wakil Kepala Kurikulum")
        print("      - Wakil Kepala Kesiswaan")
        print("      - Bendahara")
        print("      - Staff TU")
        print("      - etc.")
        print("   4. Edit users and reassign them to proper jabatan")
    else:
        print("\n✅ Jabatan master data looks good!")

    if users_no_jabatan:
        print("\n⚠️  Assign jabatan to users marked above")
        print("   They will show 'Jabatan belum ditentukan' in public agenda")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_jabatan_data())
