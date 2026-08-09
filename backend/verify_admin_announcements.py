"""Verify that admin users can now see all announcements regardless of target_roles"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def verify():
    client = AsyncIOMotorClient('mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin')
    db = client.super_app_madrasah

    print("=" * 60)
    print("VERIFICATION: Admin can see all announcements")
    print("=" * 60)

    # Get admin user
    admin_user = await db.users.find_one({'roles': 'admin'})
    if not admin_user:
        print("ERROR: No admin user found!")
        return

    print(f"\n1. Admin user: {admin_user.get('username')}")
    print(f"   Roles: {admin_user.get('roles')}")

    # Get all active announcements
    anns = await db.announcements.find({
        '$or': [
            {'is_active': True},
            {'is_active': None},
            {'is_active': {'$exists': False}}
        ]
    }).to_list(100)

    print(f"\n2. Active announcements in database: {len(anns)}")

    # Import the role matching function
    import sys
    sys.path.insert(0, 'C:/super_app_madrasah/super_app_madrasah/backend')
    from routers.notifications import _user_matches_roles

    print(f"\n3. Testing role matching with updated function:")
    visible_count = 0
    for ann in anns:
        target_roles = ann.get('target_roles') or ['all']
        matches = _user_matches_roles(admin_user, target_roles)

        print(f"\n   Announcement: {ann.get('title')}")
        print(f"   - target_roles: {target_roles}")
        print(f"   - Admin can see: {matches}")

        if matches:
            visible_count += 1

    print(f"\n" + "=" * 60)
    print(f"RESULT: Admin can see {visible_count} out of {len(anns)} announcements")
    print("=" * 60)

    if visible_count == len(anns):
        print("\n✓ SUCCESS: Admin can now see ALL announcements!")
    else:
        print(f"\n✗ ISSUE: Admin can only see {visible_count}/{len(anns)} announcements")

asyncio.run(verify())
