"""
Check push subscriptions in detail
Shows all subscriptions in the database
"""

import asyncio
from core import db

async def check():
    # Get ALL push subscriptions
    subs = await db.push_subscriptions.find({}, {'_id': 0}).to_list(1000)

    print(f'\n{"="*60}')
    print(f'PUSH SUBSCRIPTIONS IN DATABASE')
    print(f'{"="*60}\n')

    print(f'Total subscriptions: {len(subs)}\n')

    if len(subs) == 0:
        print('No subscriptions found in database!')
        print('\nPossible issues:')
        print('  1. User has not clicked "Aktifkan Notifikasi" button')
        print('  2. Frontend subscription failed (check browser console)')
        print('  3. Backend /push/subscribe endpoint failed (check logs)')
        print('  4. Database write failed')
    else:
        print('Subscriptions found:')
        for i, sub in enumerate(subs, 1):
            # Get user info
            user = await db.users.find_one(
                {'id': sub.get('user_id')},
                {'_id': 0, 'full_name': 1, 'roles': 1}
            )

            print(f'\n{i}. Subscription ID: {sub.get("id")}')
            print(f'   User ID: {sub.get("user_id")}')
            if user:
                print(f'   User: {user.get("full_name")}')
                print(f'   Roles: {", ".join(user.get("roles", []))}')
            print(f'   Endpoint: {sub.get("endpoint", "")[:60]}...')
            print(f'   Created: {sub.get("created_at")}')
            print(f'   Updated: {sub.get("updated_at")}')

    print(f'\n{"="*60}\n')

asyncio.run(check())
