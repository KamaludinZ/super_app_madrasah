import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin')
    db = client.super_app_madrasah

    anns = await db.announcements.find({}).to_list(10)
    print('Pengumuman di database:')
    for a in anns:
        print(f"  - {a.get('title')}: target_roles={a.get('target_roles')}, is_active={a.get('is_active')}")

    users = await db.users.find({}).limit(5).to_list(10)
    print('\nSample users dengan roles:')
    for u in users:
        print(f"  - {u.get('username')}: roles={u.get('roles')}")

asyncio.run(check())
