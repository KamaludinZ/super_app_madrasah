"""
Test push notification with REAL subscription from database
"""

import asyncio
from core import db
from dotenv import load_dotenv

load_dotenv()

async def test_real():
    print('\n' + '='*60)
    print('TESTING WITH REAL SUBSCRIPTION')
    print('='*60 + '\n')

    # Get a real subscription from database
    sub = await db.push_subscriptions.find_one(
        {'user_id': 'c733ed7d-963f-4c1e-9401-2f266f038695'},  # Drs. Andi Pranowo
        {'_id': 0}
    )

    if not sub:
        print('No subscription found!')
        return

    print(f'Found subscription:')
    print(f'  User ID: {sub.get("user_id")}')
    print(f'  Endpoint: {sub.get("endpoint")[:60]}...')
    print()

    # Try with old pywebpush
    print('Testing with pywebpush library...')
    try:
        from pywebpush import webpush
        import os
        import json

        def get_vapid_private_key():
            raw = os.environ.get("VAPID_PRIVATE_KEY", "")
            if not raw:
                return None
            return raw.replace("\\n", "\n")

        subscription_info = {
            "endpoint": sub.get('endpoint'),
            "keys": sub.get('keys', {})
        }

        payload = {
            "title": "Test Real Push",
            "body": "Testing with real subscription from database",
            "url": "/dashboard"
        }

        result = webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=get_vapid_private_key(),
            vapid_claims={"sub": "mailto:admyt.mtsn2kotamalang@gmail.com"},
            ttl=60
        )

        print('[SUCCESS] pywebpush worked!')
        print(f'Result: {result}')

    except Exception as e:
        error_msg = str(e)
        print(f'[FAILED] Error: {error_msg[:200]}')

        if 'Could not deserialize' in error_msg:
            print('\nThis is the VAPID key deserialization error.')
        elif '201' in error_msg or 'Created' in error_msg:
            print('\n[ACTUALLY SUCCESS] Error message contains "201" - notification sent!')
        else:
            print(f'\nUnknown error type')

    print('\n' + '='*60 + '\n')

asyncio.run(test_real())
