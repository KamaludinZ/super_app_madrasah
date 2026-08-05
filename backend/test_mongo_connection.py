"""Test MongoDB Atlas connection"""
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

load_dotenv('.env', override=True)

async def test_connection():
    mongo_url = os.getenv('MONGO_URL')
    db_name = os.getenv('DB_NAME', 'super_app_madrasah')

    print(f"Testing connection to: {mongo_url[:50]}...")
    print(f"Database: {db_name}")

    # Increase timeout to 30 seconds
    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
        socketTimeoutMS=30000,
    )

    try:
        # Test connection
        print("\nTesting server info...")
        info = await client.server_info()
        print(f"✅ Connected successfully!")
        print(f"MongoDB version: {info.get('version')}")

        # Test database access
        print(f"\nTesting database access to '{db_name}'...")
        db = client[db_name]

        # List collections
        collections = await db.list_collection_names()
        print(f"✅ Collections found: {len(collections)}")
        if collections:
            print(f"   Sample collections: {collections[:5]}")

        # Test settings query
        print("\nTesting settings query...")
        settings = await db.settings.find_one({'id': 'global_config'})
        if settings:
            print(f"✅ Settings found: {settings.get('nama_sekolah', 'N/A')}")
        else:
            print("⚠️  No settings found")

    except Exception as e:
        print(f"❌ Connection failed: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_connection())
