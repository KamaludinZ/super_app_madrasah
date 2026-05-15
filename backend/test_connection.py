"""Test MongoDB Atlas connection"""
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv('.env')

async def test_connection():
    try:
        mongo_url = os.environ['MONGO_URL']
        db_name = os.environ['DB_NAME']

        print(f"Connecting to MongoDB Atlas...")
        print(f"Database: {db_name}")

        client = AsyncIOMotorClient(mongo_url)

        # Test connection
        await client.admin.command('ping')
        print("[OK] MongoDB Atlas connection successful!")

        # List databases
        db_list = await client.list_database_names()
        print(f"[OK] Available databases: {db_list}")

        # Test database access
        db = client[db_name]
        collections = await db.list_collection_names()
        print(f"[OK] Collections in '{db_name}': {collections if collections else '(empty - ready for seeding)'}")

        client.close()
        return True

    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_connection())
