import asyncio
from core import db

async def check():
    # Find ALL push subscriptions
    subs = await db.push_subscriptions.find({}, {'_id': 0, 'user_id': 1}).to_list(1000)

    # Get unique user IDs
    user_ids = list(set(sub.get('user_id') for sub in subs if sub.get('user_id')))

    # Get user info for all subscribed users
    users = await db.users.find(
        {'id': {'$in': user_ids}},
        {'_id': 0, 'id': 1, 'full_name': 1, 'roles': 1}
    ).to_list(1000)

    print(f'Users with push subscription: {len(users)}')
    for u in users:
        roles = ', '.join(u.get('roles', []))
        print(f'  - {u.get("full_name")} ({roles})')

    # Find teachers specifically
    teachers = [u for u in users if 'guru' in u.get('roles', [])]
    print(f'\nTeachers with subscription: {len(teachers)}')

asyncio.run(check())
