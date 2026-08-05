"""
Quick Local MongoDB Seeder - Hardcoded untuk development lokal
"""
import asyncio
import sys
sys.path.insert(0, '.')

# Import seed function
from seed_local_mongodb import seed_all_data
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    # Hardcoded local MongoDB connection
    MONGO_URL = "mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin"
    DB_NAME = "super_app_madrasah"

    print(f"\nConnecting to Local MongoDB Docker...")
    print(f"URL: mongodb://admin:***@localhost:27017/{DB_NAME}")
    print(f"Database: {DB_NAME}\n")

    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]

        # Test connection
        await client.admin.command('ping')
        print("SUCCESS! Local MongoDB connection established!\n")

        await seed_all_data(db)
    except Exception as e:
        print(f"\nERROR: {e}")
        print("Make sure MongoDB Docker container is running!")
        print("Run: docker-compose up -d mongodb\n")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(main())
