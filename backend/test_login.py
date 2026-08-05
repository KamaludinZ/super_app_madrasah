"""
Test login directly with database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from auth_utils import verify_password

async def main():
    # Connect to local MongoDB
    MONGO_URL = "mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin"
    DB_NAME = "super_app_madrasah"

    print(f"Testing login with MongoDB...")
    print(f"URL: mongodb://admin:***@localhost:27017/{DB_NAME}\n")

    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]

        # Test connection
        await client.admin.command('ping')
        print("[OK] MongoDB connected\n")

        # Find admin user
        username = "admin"
        password = "admin123"

        user = await db.users.find_one({'username': username})

        if not user:
            print(f"[ERROR] User '{username}' not found!")
            return

        print(f"[OK] User found: {user.get('full_name')}")
        print(f"     Username: {user.get('username')}")
        print(f"     Roles: {user.get('roles')}")
        print(f"     Is active: {user.get('is_active')}")

        # Test password
        password_hash = user.get('password_hash')
        if not password_hash:
            print("[ERROR] User has no password hash!")
            return

        print(f"\n[INFO] Testing password verification...")
        is_valid = verify_password(password, password_hash)

        if is_valid:
            print(f"[OK] Password is CORRECT! Login should work.")
        else:
            print(f"[ERROR] Password is INCORRECT!")

            # Try to check what password would work
            from auth_utils import hash_password
            test_hash = hash_password(password)
            print(f"\n[DEBUG] Hash in DB starts with: {password_hash[:30]}...")
            print(f"[DEBUG] Hash for '{password}' starts with: {test_hash[:30]}...")

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(main())
