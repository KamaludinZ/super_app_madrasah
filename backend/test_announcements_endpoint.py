"""Test announcements endpoint with real user data"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test():
    client = AsyncIOMotorClient('mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin')
    db = client.super_app_madrasah

    # Get a user with 'admin' role
    admin_user = await db.users.find_one({'roles': 'admin'})
    if admin_user:
        print(f"Testing with admin user: {admin_user.get('username')}")
        print(f"  Roles: {admin_user.get('roles')}")

    # Get announcements (simulate what backend does)
    print("\n=== Testing announcement filtering ===")

    # Query with new filter
    anns = await db.announcements.find({
        '$or': [
            {'is_active': True},
            {'is_active': None},
            {'is_active': {'$exists': False}}
        ]
    }).to_list(100)

    print(f"\nFound {len(anns)} announcements with new filter")

    for ann in anns:
        target_roles = ann.get('target_roles') or ['all']
        print(f"\n  - {ann.get('title')}")
        print(f"    target_roles: {target_roles}")
        print(f"    is_active: {ann.get('is_active')}")

        # Check if admin should see this
        user_roles = set(admin_user.get('roles', []))
        should_see = False

        if not target_roles or 'all' in target_roles:
            should_see = True
        else:
            should_see = bool(user_roles & set(target_roles))

        print(f"    Admin should see: {should_see}")
        if not should_see:
            print(f"    (user roles {user_roles} don't match target {set(target_roles)})")

    # Now test with a guru user
    print("\n\n=== Testing with guru user ===")
    guru_user = await db.users.find_one({'roles': 'guru'})
    if guru_user:
        print(f"Testing with guru user: {guru_user.get('username')}")
        print(f"  Roles: {guru_user.get('roles')}")

        for ann in anns:
            target_roles = ann.get('target_roles') or ['all']
            user_roles = set(guru_user.get('roles', []))

            should_see = False
            if not target_roles or 'all' in target_roles:
                should_see = True
            else:
                should_see = bool(user_roles & set(target_roles))

            if should_see:
                print(f"\n  WILL SEE: {ann.get('title')}")
                print(f"    target: {target_roles}, user: {list(user_roles)}")

asyncio.run(test())
