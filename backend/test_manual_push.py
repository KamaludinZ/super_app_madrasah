"""
Test manual push notification to a specific user
"""

import asyncio
from core import db

async def test_push():
    print('\n' + '='*60)
    print('MANUAL PUSH NOTIFICATION TEST')
    print('='*60 + '\n')

    # Get teacher Drs. Andi Pranowo
    teacher = await db.users.find_one(
        {'full_name': {'$regex': 'Andi Pranowo', '$options': 'i'}},
        {'_id': 0, 'id': 1, 'full_name': 1}
    )

    if not teacher:
        print('Teacher not found!')
        return

    print(f'Target user: {teacher.get("full_name")}')
    print(f'User ID: {teacher.get("id")}\n')

    # Check if user has subscription
    sub_count = await db.push_subscriptions.count_documents(
        {'user_id': teacher['id']}
    )

    print(f'Subscriptions found: {sub_count}\n')

    if sub_count == 0:
        print('User has no push subscriptions!')
        return

    # Send test push notification
    print('Sending test push notification...\n')

    from routers.push import send_push_to_users

    payload = {
        'title': 'Test Notifikasi Manual',
        'body': 'Ini adalah test notifikasi push manual. Jika Anda menerima ini, berarti push notification berfungsi!',
        'icon': '/icon-192.png',
        'badge': '/icon-192.png',
        'data': {
            'action': 'test',
            'url': '/dashboard'
        },
        'requireInteraction': True
    }

    result = await send_push_to_users([teacher['id']], payload)

    print(f'Result:')
    print(f'  - Sent: {result.get("sent", 0)}')
    print(f'  - Failed: {result.get("failed", 0)}')
    print(f'  - Removed (stale): {result.get("removed", 0)}')

    if result.get('sent', 0) > 0:
        print('\nSUCCESS! Check the device for notification.')
    else:
        print('\nFAILED! No notifications sent.')

    print('\n' + '='*60 + '\n')

asyncio.run(test_push())
