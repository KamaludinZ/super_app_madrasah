"""
Test RKAM query untuk debug
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test_query():
    MONGO_URL = "mongodb+srv://kamaludinzuhri_db_user:Mtsn2kotamalang*@cluster0.qougudd.mongodb.net/?retryWrites=true&w=majority"
    DB_NAME = "super_app_madrasah"

    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]

    try:
        await client.admin.command('ping')
        print("Connected to MongoDB Atlas\n")

        # Test 1: Query with is_active filter
        print("="*70)
        print("Test 1: Query dengan is_active=True filter (seperti di API)")
        print("="*70)
        query1 = {'is_active': True, 'fiscal_year': '2025/2026'}
        items1 = await db.rkam_budget_items.find(query1).to_list(None)
        print(f"Items found: {len(items1)}")
        if items1:
            print("Sample item:")
            print(f"  - has is_active field: {'is_active' in items1[0]}")
            print(f"  - is_active value: {items1[0].get('is_active', 'NOT SET')}")
            print(f"  - code: {items1[0].get('code')}")
            print(f"  - description: {items1[0].get('description')}")

        # Test 2: Query without is_active filter
        print("\n" + "="*70)
        print("Test 2: Query TANPA is_active filter")
        print("="*70)
        query2 = {'fiscal_year': '2025/2026'}
        items2 = await db.rkam_budget_items.find(query2).to_list(None)
        print(f"Items found: {len(items2)}")
        if items2:
            print("\nSample items:")
            for i, item in enumerate(items2[:3]):
                print(f"\n  Item {i+1}:")
                print(f"    code: {item.get('code')}")
                print(f"    sumber_dana: {item.get('sumber_dana')}")
                print(f"    is_active: {item.get('is_active', 'NOT SET')}")

        # Test 3: Check all documents
        print("\n" + "="*70)
        print("Test 3: Semua RKAM items (tanpa filter apapun)")
        print("="*70)
        all_items = await db.rkam_budget_items.find({}).to_list(None)
        print(f"Total items in database: {len(all_items)}")

        # Check is_active distribution
        active_count = sum(1 for item in all_items if item.get('is_active') == True)
        inactive_count = sum(1 for item in all_items if item.get('is_active') == False)
        no_field_count = sum(1 for item in all_items if 'is_active' not in item)

        print(f"\nDistribusi is_active:")
        print(f"  - is_active = True:  {active_count}")
        print(f"  - is_active = False: {inactive_count}")
        print(f"  - No is_active field: {no_field_count}")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_query())
