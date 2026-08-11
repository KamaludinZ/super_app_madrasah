"""
Test script untuk teaching reminder scheduler
Menampilkan:
- Jadwal hari ini
- Waktu notifikasi (10 menit sebelum + saat mulai)
- Reminder yang sudah terkirim hari ini
"""

import asyncio
from datetime import datetime, timedelta
from core import db
from teaching_reminder_scheduler import get_current_day_indonesian, get_current_time_wib
from core import get_active_context
from journal_core import now_wib


async def test_teaching_reminder():
    # Get current info
    current_date, current_time, current_hour, current_minute = await get_current_time_wib()
    day = await get_current_day_indonesian()

    print(f"\n{'='*60}")
    print(f"TEACHING REMINDER TEST - {day} {current_time}")
    print(f"{'='*60}\n")

    # Get active semester
    ctx = await get_active_context(None)
    semester_id = ctx.get('semester_id')

    if not semester_id:
        print("❌ No active semester found")
        return

    print(f"✓ Active semester: {semester_id[:8]}...")

    # Get schedules for today
    schedules = await db.schedules.find({
        'semester_id': semester_id,
        'day': day
    }, {'_id': 0}).to_list(1000)

    print(f"✓ Found {len(schedules)} schedules for {day}\n")

    # Get reminders sent today
    reminders_sent = await db.teaching_reminders.find({
        'date': current_date
    }, {'_id': 0}).to_list(1000)

    print(f"📤 Reminders sent today: {len(reminders_sent)}\n")

    # Show next 5 upcoming schedules
    print(f"{'='*60}")
    print("UPCOMING SCHEDULES (Next 5)")
    print(f"{'='*60}\n")

    upcoming = []
    for schedule in schedules:
        start_time = schedule.get('start_time', '')
        if not start_time or ':' not in start_time:
            continue

        try:
            start_hour, start_minute = map(int, start_time.split(':'))

            # Calculate 10-min before time
            reminder_time = datetime.now().replace(
                hour=start_hour,
                minute=start_minute,
                second=0,
                microsecond=0
            ) - timedelta(minutes=10)

            # Skip if already passed
            now = datetime.now()
            schedule_time = datetime.now().replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)

            if schedule_time > now:
                upcoming.append({
                    'schedule': schedule,
                    'start_time': start_time,
                    'reminder_time': reminder_time.strftime('%H:%M'),
                    'start_hour': start_hour,
                    'start_minute': start_minute
                })
        except:
            continue

    # Sort by start time
    upcoming.sort(key=lambda x: (x['start_hour'], x['start_minute']))

    # Get teacher and subject info for display
    for i, item in enumerate(upcoming[:5], 1):
        schedule = item['schedule']

        # Get teacher
        teacher = await db.users.find_one({'id': schedule.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        teacher_name = teacher.get('full_name', 'Unknown') if teacher else 'Unknown'

        # Get subject
        subject = await db.subjects.find_one({'id': schedule.get('subject_id')}, {'_id': 0, 'name': 1})
        subject_name = subject.get('name', 'Unknown') if subject else 'Unknown'

        # Get class
        kelas = await db.classes.find_one({'id': schedule.get('class_id')}, {'_id': 0, 'name': 1})
        class_name = kelas.get('name', 'Unknown') if kelas else 'Unknown'

        # Check if reminders sent
        before_sent = any(r for r in reminders_sent if r.get('schedule_id') == schedule.get('id') and r.get('reminder_type') == 'before')
        start_sent = any(r for r in reminders_sent if r.get('schedule_id') == schedule.get('id') and r.get('reminder_type') == 'start')

        print(f"{i}. {item['start_time']} - {subject_name} ({class_name})")
        print(f"   Teacher: {teacher_name}")
        print(f"   Reminder times:")
        print(f"     - 10 min before: {item['reminder_time']} {'✓ Sent' if before_sent else '⏳ Pending'}")
        print(f"     - Start time: {item['start_time']} {'✓ Sent' if start_sent else '⏳ Pending'}")
        print(f"   Schedule ID: {schedule.get('id')[:16]}...")
        print()

    # Show current time and next check
    print(f"{'='*60}")
    print(f"Current time: {current_time}")
    print(f"Next scheduler check: {current_time} (checks every minute)")
    print(f"{'='*60}\n")

    # Show example of what will happen
    if upcoming:
        next_schedule = upcoming[0]
        print(f"⏰ NEXT UPCOMING:")
        print(f"   - At {next_schedule['reminder_time']}: Send '10 minutes before' notification")
        print(f"   - At {next_schedule['start_time']}: Send 'start time' notification")
        print()


if __name__ == '__main__':
    asyncio.run(test_teaching_reminder())
