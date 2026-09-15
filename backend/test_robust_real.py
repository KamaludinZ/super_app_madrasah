"""
Test robust web push with REAL subscription
"""

import asyncio
from core import db
from dotenv import load_dotenv
from web_push_robust import send_web_push

load_dotenv()

async def test():
    print('\n' + '='*60)
    print('TESTING ROBUST WEB PUSH WITH REAL SUBSCRIPTION')
    print('='*60 + '\n')

    # Get real subscription from Drs. Andi Pranowo
    sub = await db.push_subscriptions.find_one(
        {'user_id': 'c733ed7d-963f-4c1e-9401-2f266f038695'},
        {'_id': 0}
    )

    if not sub:
        print('No subscription found!')
        return

    print(f'Found subscription for user: {sub.get("user_id")}')
    print(f'Endpoint: {sub.get("endpoint")[:60]}...')
    print()

    subscription_info = {
        "endpoint": sub.get('endpoint'),
        "keys": sub.get('keys', {})
    }

    payload = {
        "title": "🎉 Push Notification Berhasil!",
        "body": "Implementation baru Web Push sudah berfungsi dengan baik!",
        "url": "/dashboard",
        "icon": "/icon-192.png",
        "badge": "/icon-192.png"
    }

    print('Sending push notification...')
    result = await send_web_push(subscription_info, payload)

    print(f'\nResult:')
    print(f'  OK: {result.get("ok")}')
    print(f'  Gone: {result.get("gone")}')
    print(f'  Error: {result.get("error")}')

    if result.get('ok'):
        print('\n✅ SUCCESS! Push notification sent!')
        print('Check device for notification.')
    elif result.get('gone'):
        print('\n⚠️  Subscription expired/invalid')
    else:
        print(f'\n❌ FAILED: {result.get("error")}')

    print('\n' + '='*60 + '\n')

asyncio.run(test())
