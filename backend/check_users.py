"""
Quick script to check if users exist in MongoDB
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    # Connect to local MongoDB
    MONGO_URL = "mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin"
    DB_NAME = "super_app_madrasah"

    print(f"Connecting to MongoDB...")
    print(f"URL: mongodb://admin:***@localhost:27017/{DB_NAME}\n")

    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]

        # Test connection
        await client.admin.command('ping')
        print("[OK] MongoDB connection successful!\n")

        # Check users collection
        users_count = await db.users.count_documents({})
        print(f"Total users in database: {users_count}\n")

        # Check admin user
        admin = await db.users.find_one({'username': 'admin'})
        if admin:
            print("[OK] Admin user found!")
            print(f"   Username: {admin.get('username')}")
            print(f"   Full name: {admin.get('full_name')}")
            print(f"   Roles: {admin.get('roles')}")
            print(f"   Has password_hash: {'Yes' if admin.get('password_hash') else 'No'}")
            print(f"   Is active: {admin.get('is_active')}")
        else:
            print("[ERROR] Admin user NOT found!")

        # List all users
        print(f"\nAll users:")
        async for user in db.users.find({}).limit(10):
            print(f"   - {user.get('username')} ({user.get('full_name')}) - Roles: {user.get('roles')}")

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(main())
