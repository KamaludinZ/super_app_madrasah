"""Verify the newly created RKAM item in MongoDB Atlas"""
import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load .env from backend directory
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def verify_new_item():
    # Use MongoDB Atlas directly (hardcoded for verification)
    mongo_url = "mongodb+srv://kamaludinzuhri_db_user:Mtsn2kotamalang*@cluster0.qougudd.mongodb.net/?retryWrites=true&w=majority"
    db_name = 'super_app_madrasah'

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print("=" * 60)
    print("Checking newly created RKAM item")
    print("=" * 60)

    # Find the item we just created
    item_id = "c4362eb6-1746-48f9-9d21-2a55379d7c3a"
    item = await db.rkam_budget_items.find_one({'id': item_id})

    if item:
        print(f"✅ Item FOUND in database!")
        print(f"\nItem details:")
        print(f"  ID: {item.get('id')}")
        print(f"  Code: {item.get('code')}")
        print(f"  Name: {item.get('name')}")
        print(f"  Category: {item.get('category')}")
        print(f"  Bidang: {item.get('bidang')}")
        print(f"  Sumber Dana: {item.get('sumber_dana')}")
        print(f"  Allocated: Rp {item.get('allocated_amount'):,.0f}")
        print(f"  Realized: Rp {item.get('realized_amount'):,.0f}")
        print(f"  Fiscal Year: {item.get('fiscal_year')}")
        print(f"  Created At: {item.get('created_at')}")
        print(f"  Created By: {item.get('created_by')}")
    else:
        print(f"❌ Item NOT found in database!")

    # Count total items
    total = await db.rkam_budget_items.count_documents({})
    print(f"\nTotal RKAM items in database: {total}")

    # List all items for fiscal year 2025/2026
    items = await db.rkam_budget_items.find({'fiscal_year': '2025/2026'}).to_list(None)
    print(f"Items for fiscal year 2025/2026: {len(items)}")

    for idx, item in enumerate(items, 1):
        print(f"  {idx}. {item.get('code', 'NO-CODE')} - {item.get('name')} (Rp {item.get('allocated_amount'):,.0f})")

    client.close()

if __name__ == "__main__":
    asyncio.run(verify_new_item())
