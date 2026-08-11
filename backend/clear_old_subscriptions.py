"""
Clear all old push subscriptions
Run this after VAPID keys have been regenerated
"""

import asyncio
from core import db

async def clear():
    print('\n' + '='*60)
    print('CLEARING OLD PUSH SUBSCRIPTIONS')
    print('='*60 + '\n')

    # Count existing subscriptions
    count_before = await db.push_subscriptions.count_documents({})
    print(f'Subscriptions before: {count_before}')

    if count_before == 0:
        print('No subscriptions to clear.')
        print('\n' + '='*60 + '\n')
        return

    # Delete all subscriptions
    result = await db.push_subscriptions.delete_many({})

    print(f'Deleted: {result.deleted_count}')
    print('\nAll old subscriptions cleared!')
    print('\nUsers need to:')
    print('  1. Refresh the page')
    print('  2. Click "Aktifkan Notifikasi" banner')
    print('  3. Grant permission when prompted')

    print('\n' + '='*60 + '\n')

asyncio.run(clear())
