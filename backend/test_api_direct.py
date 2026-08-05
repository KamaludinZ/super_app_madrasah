"""
Test API endpoint directly
"""
import asyncio
import sys
sys.path.insert(0, '.')

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def test_api_logic():
    """Simulate the exact logic in the API endpoint"""

    # Get DB connection like the API does
    mongo_url = os.getenv('MONGO_URL')
    db_name = os.getenv('DB_NAME', 'super_app_madrasah')

    print(f"MONGO_URL: {mongo_url[:50]}...")
    print(f"DB_NAME: {db_name}\n")

    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
    db = client[db_name]

    try:
        await client.admin.command('ping')
        print("✓ Connected to MongoDB Atlas\n")

        # Simulate the endpoint logic
        fiscal_year = "2025/2026"
        bidang = None

        query = {'is_active': True}
        if fiscal_year:
            query['fiscal_year'] = fiscal_year
        if bidang:
            query['bidang'] = bidang

        print(f"Query: {query}\n")

        items = await db.rkam_budget_items.find(query).to_list(None)
        print(f"Found {len(items)} items\n")

        if not items:
            print("ERROR: No items found!")
            return

        # Calculate totals
        total_allocated = sum(item.get('allocated_amount', 0.0) for item in items)
        total_realized = sum(item.get('realized_amount', 0.0) for item in items)
        total_remaining = sum(item.get('remaining_amount', 0.0) for item in items)

        # Group by sumber_dana
        sumber_dana_groups = {}
        for item in items:
            sumber = item.get('sumber_dana', 'LAINNYA')
            if sumber not in sumber_dana_groups:
                sumber_dana_groups[sumber] = {
                    'sumber_dana': sumber,
                    'allocated': 0.0,
                    'realized': 0.0,
                    'remaining': 0.0
                }
            sumber_dana_groups[sumber]['allocated'] += item.get('allocated_amount', 0.0)
            sumber_dana_groups[sumber]['realized'] += item.get('realized_amount', 0.0)
            sumber_dana_groups[sumber]['remaining'] += item.get('remaining_amount', 0.0)

        # Group by category
        categories = {}
        for item in items:
            cat = item.get('category', 'Lainnya')
            if cat not in categories:
                categories[cat] = {
                    'category': cat,
                    'allocated': 0.0,
                    'realized': 0.0,
                    'remaining': 0.0,
                    'items': []
                }
            categories[cat]['allocated'] += item.get('allocated_amount', 0.0)
            categories[cat]['realized'] += item.get('realized_amount', 0.0)
            categories[cat]['remaining'] += item.get('remaining_amount', 0.0)
            categories[cat]['items'].append({
                'id': item.get('id'),
                'code': item.get('code'),
                'name': item.get('name'),
                'sumber_dana': item.get('sumber_dana'),
                'allocated': item.get('allocated_amount', 0.0),
                'realized': item.get('realized_amount', 0.0),
                'remaining': item.get('remaining_amount', 0.0)
            })

        result = {
            'fiscal_year': fiscal_year,
            'total_allocated': total_allocated,
            'total_realized': total_realized,
            'total_remaining': total_remaining,
            'percentage_realized': (total_realized / total_allocated * 100) if total_allocated > 0 else 0,
            'sumber_dana_groups': list(sumber_dana_groups.values()),
            'categories': list(categories.values())
        }

        print("="*70)
        print("API RESPONSE (simulated):")
        print("="*70)
        print(f"Fiscal Year: {result['fiscal_year']}")
        print(f"Total Allocated: Rp {result['total_allocated']:,.0f}")
        print(f"Total Realized: Rp {result['total_realized']:,.0f}")
        print(f"Percentage: {result['percentage_realized']:.1f}%")
        print(f"\nSumber Dana Groups: {len(result['sumber_dana_groups'])}")
        for group in result['sumber_dana_groups']:
            print(f"  - {group['sumber_dana']}: Rp {group['allocated']:,.0f}")
        print(f"\nCategories: {len(result['categories'])}")
        for cat in result['categories']:
            print(f"  - {cat['category']}: {len(cat['items'])} items")

        print("\n✓ API logic works correctly!")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_api_logic())
