"""Check seeded data"""
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv('.env')

async def check():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    users = await db.users.count_documents({})
    classes_count = await db.classes.count_documents({})
    subjects = await db.subjects.count_documents({})
    rooms = await db.rooms.count_documents({})
    schedules = await db.schedules.count_documents({})

    print(f'[OK] Database: {os.environ["DB_NAME"]}')
    print(f'[OK] Users: {users}')
    print(f'[OK] Classes: {classes_count}')
    print(f'[OK] Subjects: {subjects}')
    print(f'[OK] Rooms: {rooms}')
    print(f'[OK] Schedules: {schedules}')

    # Get a sample user
    admin = await db.users.find_one({'username': 'admin'})
    if admin:
        print(f'\n[INFO] Sample login credentials:')
        print(f'  Username: admin')
        print(f'  Password: admin123 (default password from seed)')
        print(f'  Roles: {admin.get("roles", [])}')

    client.close()

asyncio.run(check())
