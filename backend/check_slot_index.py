"""
Check slot_index values in schedules collection
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_schedules():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['matsandatama']

    # Get all schedules sorted by day and time
    schedules = await db.schedules.find({}).sort([('day', 1), ('start_time', 1)]).to_list(100)

    print('Schedule Data with slot_index:')
    print('=' * 100)
    print(f"{'Day':<10} {'Start':<8} {'End':<8} {'Slot Index':<12} {'Class':<15} {'Subject':<20}")
    print('=' * 100)

    for s in schedules:
        # Get class and subject names
        cls = await db.classes.find_one({'id': s.get('class_id')}, {'_id': 0, 'name': 1})
        sub = await db.subjects.find_one({'id': s.get('subject_id')}, {'_id': 0, 'name': 1, 'code': 1})

        class_name = cls.get('name') if cls else 'N/A'
        subject_name = f"{sub.get('code')}-{sub.get('name')}" if sub else 'N/A'

        print(f"{s.get('day'):<10} {s.get('start_time'):<8} {s.get('end_time'):<8} {str(s.get('slot_index')):<12} {class_name:<15} {subject_name[:20]:<20}")

    # Check if slot_index exists and what values it has
    print('\n\nSlot Index Statistics:')
    print('=' * 100)
    pipeline = [
        {'$group': {'_id': '$slot_index', 'count': {'$sum': 1}}},
        {'$sort': {'_id': 1}}
    ]
    stats = await db.schedules.aggregate(pipeline).to_list(100)
    for stat in stats:
        print(f"Slot Index: {stat['_id']} - Count: {stat['count']}")

    # Test grouping function
    print('\n\nTest Grouping Function:')
    print('=' * 100)

    # Import the grouping function
    import sys
    sys.path.insert(0, '.')
    from routers.schedules import _group_schedules_by_jtm

    # Enrich schedules with related data for grouping test
    enriched = []
    for s in schedules:
        cls = await db.classes.find_one({'id': s.get('class_id')}, {'_id': 0, 'name': 1})
        sub = await db.subjects.find_one({'id': s.get('subject_id')}, {'_id': 0, 'name': 1, 'code': 1})
        teacher = await db.users.find_one({'id': s.get('teacher_id')}, {'_id': 0, 'full_name': 1})

        s_copy = dict(s)
        s_copy['class_name'] = cls.get('name') if cls else None
        s_copy['subject_name'] = sub.get('name') if sub else None
        s_copy['subject_code'] = sub.get('code') if sub else None
        s_copy['teacher_name'] = teacher.get('full_name') if teacher else None
        enriched.append(s_copy)

    # Apply grouping
    grouped = _group_schedules_by_jtm(enriched)

    print(f"\nOriginal schedules: {len(enriched)}")
    print(f"Grouped schedules: {len(grouped)}")
    print("\nGrouped entries (first 10):")
    for i, g in enumerate(grouped[:10]):
        print(f"\n{i+1}. {g.get('day')} - {g.get('class_name')} - {g.get('subject_name')}")
        print(f"   JTM Count: {g.get('jtm_count')}")
        print(f"   Hour Range: {g.get('hour_range')}")
        print(f"   Time Range: {g.get('time_range')}")
        print(f"   Hours: {g.get('hours')}")

    client.close()

if __name__ == '__main__':
    asyncio.run(check_schedules())
