"""
Verifikasi data RKAM yang sudah diseeded di MongoDB Atlas
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def verify_rkam():
    # MongoDB Atlas connection
    MONGO_URL = "mongodb+srv://kamaludinzuhri_db_user:Mtsn2kotamalang*@cluster0.qougudd.mongodb.net/"
    DB_NAME = "super_app_madrasah"

    print("Connecting to MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]

    try:
        # Test connection
        await client.admin.command('ping')
        print("SUCCESS! Connected to MongoDB Atlas\n")

        print("="*70)
        print("VERIFIKASI DATA RKAM")
        print("="*70)

        # Get all RKAM budget items
        fiscal_year = "2025/2026"
        items = await db.rkam_budget_items.find({'fiscal_year': fiscal_year}).to_list(None)

        print(f"\nTotal RKAM Budget Items untuk {fiscal_year}: {len(items)}\n")

        # Group by sumber_dana
        bos_items = [item for item in items if item.get('sumber_dana') == 'BOS']
        komite_items = [item for item in items if item.get('sumber_dana') == 'KOMITE']

        # Calculate totals
        bos_allocated = sum(item.get('allocated_amount', 0) for item in bos_items)
        bos_realized = sum(item.get('realized_amount', 0) for item in bos_items)
        bos_remaining = bos_allocated - bos_realized
        bos_percentage = (bos_realized / bos_allocated * 100) if bos_allocated > 0 else 0

        komite_allocated = sum(item.get('allocated_amount', 0) for item in komite_items)
        komite_realized = sum(item.get('realized_amount', 0) for item in komite_items)
        komite_remaining = komite_allocated - komite_realized
        komite_percentage = (komite_realized / komite_allocated * 100) if komite_allocated > 0 else 0

        print("RINGKASAN ANGGARAN BOS:")
        print("-"*70)
        print(f"  Total Anggaran       : Rp {bos_allocated:>15,.0f}")
        print(f"  Realisasi           : Rp {bos_realized:>15,.0f} ({bos_percentage:.1f}%)")
        print(f"  Sisa Anggaran       : Rp {bos_remaining:>15,.0f}")
        print(f"  Jumlah Item          : {len(bos_items)}")

        print("\nRINGKASAN ANGGARAN KOMITE:")
        print("-"*70)
        print(f"  Total Anggaran       : Rp {komite_allocated:>15,.0f}")
        print(f"  Realisasi           : Rp {komite_realized:>15,.0f} ({komite_percentage:.1f}%)")
        print(f"  Sisa Anggaran       : Rp {komite_remaining:>15,.0f}")
        print(f"  Jumlah Item          : {len(komite_items)}")

        # Detail per item
        print("\n" + "="*70)
        print("DETAIL ANGGARAN BOS:")
        print("="*70)
        for item in bos_items:
            print(f"\n{item.get('code')}: {item.get('description')}")
            print(f"  Bidang        : {item.get('bidang', 'N/A')}")
            print(f"  Category      : {item.get('category', 'N/A')}")
            print(f"  Allocated     : Rp {item.get('allocated_amount', 0):>12,.0f}")
            print(f"  Realized      : Rp {item.get('realized_amount', 0):>12,.0f}")
            percent = (item.get('realized_amount', 0) / item.get('allocated_amount', 1) * 100)
            print(f"  Progress      : {percent:.1f}%")

        print("\n" + "="*70)
        print("DETAIL ANGGARAN KOMITE:")
        print("="*70)
        for item in komite_items:
            print(f"\n{item.get('code')}: {item.get('description')}")
            print(f"  Bidang        : {item.get('bidang', 'N/A')}")
            print(f"  Category      : {item.get('category', 'N/A')}")
            print(f"  Allocated     : Rp {item.get('allocated_amount', 0):>12,.0f}")
            print(f"  Realized      : Rp {item.get('realized_amount', 0):>12,.0f}")
            percent = (item.get('realized_amount', 0) / item.get('allocated_amount', 1) * 100)
            print(f"  Progress      : {percent:.1f}%")

        # Check documents
        print("\n" + "="*70)
        print("DOKUMEN RKAM:")
        print("="*70)
        docs = await db.rkam_documents.find({'fiscal_year': fiscal_year}).to_list(None)
        print(f"\nTotal Dokumen: {len(docs)}\n")
        for doc in docs:
            print(f"  - {doc.get('title')}")
            print(f"    Type: {doc.get('doc_type')}, Quarter: {doc.get('quarter', 'N/A')}")
            print(f"    URL: {doc.get('file_url', 'N/A')}")
            print()

        print("="*70)
        print("VERIFIKASI SELESAI!")
        print("="*70)
        print("\nKesimpulan:")
        print(f"  TOTAL BOS + KOMITE:")
        print(f"    Allocated  : Rp {bos_allocated + komite_allocated:>15,.0f}")
        print(f"    Realized   : Rp {bos_realized + komite_realized:>15,.0f}")
        overall_percent = ((bos_realized + komite_realized) / (bos_allocated + komite_allocated) * 100) if (bos_allocated + komite_allocated) > 0 else 0
        print(f"    Progress   : {overall_percent:.1f}%")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(verify_rkam())
