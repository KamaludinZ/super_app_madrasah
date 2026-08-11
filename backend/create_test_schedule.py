"""
Create test schedule for teaching reminder
Creates a schedule starting 5 minutes from now
"""

import asyncio
from datetime import datetime, timedelta
from core import db, get_active_context
from models import ScheduleModel
from teaching_reminder_scheduler import get_current_day_indonesian


async def create_test_schedule():
    # Get current info
    ctx = await get_active_context(None)
    semester_id = ctx.get('semester_id')
    day = await get_current_day_indonesian()

    # Get a teacher
    teacher = await db.users.find_one({'roles': 'guru'}, {'_id': 0, 'id': 1, 'full_name': 1})
    if not teacher:
        print("No teacher found!")
        return

    # Get a class
    kelas = await db.classes.find_one({}, {'_id': 0, 'id': 1, 'name': 1})
    if not kelas:
        print("No class found!")
        return

    # Get a subject
    subject = await db.subjects.find_one({}, {'_id': 0, 'id': 1, 'name': 1})
    if not subject:
        print("No subject found!")
        return

    # Get a room (optional)
    room = await db.rooms.find_one({}, {'_id': 0, 'id': 1, 'name': 1})

    # Calculate start time (15 minutes from now, so we can catch the 10-min reminder)
    now = datetime.now()
    start_time = now + timedelta(minutes=15)
    end_time = start_time + timedelta(minutes=40)

    # Create schedule
    schedule = ScheduleModel(
        semester_id=semester_id,
        day=day,
        start_time=start_time.strftime('%H:%M'),
        end_time=end_time.strftime('%H:%M'),
        teacher_id=teacher['id'],
        class_id=kelas['id'],
        subject_id=subject['id'],
        room_id=room['id'] if room else ''
    )

    doc = schedule.model_dump()
    await db.schedules.insert_one(doc)

    print(f"\n=== TEST SCHEDULE CREATED ===")
    print(f"Teacher: {teacher.get('full_name')}")
    print(f"Class: {kelas.get('name')}")
    print(f"Subject: {subject.get('name')}")
    print(f"Day: {day}")
    print(f"Start time: {schedule.start_time}")
    print(f"End time: {schedule.end_time}")
    print(f"Schedule ID: {schedule.id}")
    print(f"\nExpected notifications:")
    print(f"  1. 10-min before: {(start_time - timedelta(minutes=10)).strftime('%H:%M')}")
    print(f"  2. Start time: {start_time.strftime('%H:%M')}")
    print(f"\nWait for these times and check:")
    print(f"  - Backend logs for notification sending")
    print(f"  - Push notification on subscribed device")
    print(f"  - Bell sound when notification arrives")
    print()


if __name__ == '__main__':
    asyncio.run(create_test_schedule())
