"""
Comprehensive Data Seeder for MongoDB Atlas
"""
import asyncio
import sys
sys.path.insert(0, '.')

from seed_comprehensive_data import seed_comprehensive_data
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    # MongoDB Atlas connection string
    MONGO_URL = "mongodb+srv://kamaludinzuhri_db_user:Mtsn2kotamalang*@cluster0.qougudd.mongodb.net/"
    DB_NAME = "super_app_madrasah"

    print(f"[SEED] Connecting to MongoDB Atlas...")
    print(f"[SEED] Database: {DB_NAME}")

    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]

        # Test connection
        await client.admin.command('ping')
        print("[SEED] MongoDB Atlas connection successful!")

        await seed_comprehensive_data(db)
    except Exception as e:
        print(f"[SEED] ERROR: {e}")
        print("[SEED] Make sure MongoDB Atlas is accessible!")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(main())
