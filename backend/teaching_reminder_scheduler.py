"""
Teaching Reminder Scheduler
Berjalan tiap menit untuk mengirim notifikasi "waktunya mengajar"

Fitur:
- Cek jadwal guru hari ini
- Kirim notifikasi 10 menit sebelum + saat jam mulai
- Anti-dobel: track notifikasi yang sudah terkirim
- Web Push notification
- Deep link ke halaman Jurnal/Scan
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

from core import db, logger
from models import TeachingReminderModel
from journal_core import now_wib

# Setup logging
logger = logging.getLogger("teaching_reminder")


async def get_current_day_indonesian() -> str:
    """Get current day in Indonesian"""
    now = now_wib()
    days = {
        0: 'Senin',
        1: 'Selasa',
        2: 'Rabu',
        3: 'Kamis',
        4: 'Jumat',
        5: 'Sabtu',
        6: 'Minggu'
    }
    return days.get(now.weekday(), 'Senin')


async def get_current_time_wib() -> tuple:
    """Get current date and time in WIB"""
    now = now_wib()
    current_date = now.strftime('%Y-%m-%d')
    current_time = now.strftime('%H:%M')
    current_hour = now.hour
    current_minute = now.minute
    return current_date, current_time, current_hour, current_minute


async def check_if_already_sent(
    schedule_id: str,
    teacher_id: str,
    date: str,
    reminder_type: str
) -> bool:
    """
    Check if notification already sent today for this schedule

    Args:
        schedule_id: ID jadwal
        teacher_id: ID guru
        date: Tanggal (YYYY-MM-DD)
        reminder_type: 'before' atau 'start'

    Returns:
        True if already sent, False otherwise
    """
    existing = await db.teaching_reminders.find_one({
        'schedule_id': schedule_id,
        'teacher_id': teacher_id,
        'date': date,
        'reminder_type': reminder_type
    })

    return existing is not None


async def mark_as_sent(
    schedule_id: str,
    teacher_id: str,
    date: str,
    day: str,
    start_time: str,
    reminder_type: str,
    class_name: Optional[str] = None,
    subject_name: Optional[str] = None,
    room_name: Optional[str] = None,
    minutes_before: Optional[int] = None
):
    """Mark notification as sent to prevent duplicates"""
    reminder = TeachingReminderModel(
        schedule_id=schedule_id,
        teacher_id=teacher_id,
        date=date,
        day=day,
        start_time=start_time,
        reminder_type=reminder_type,
        minutes_before=minutes_before,
        class_name=class_name,
        subject_name=subject_name,
        room_name=room_name
    )

    await db.teaching_reminders.insert_one(reminder.model_dump())
    logger.info(f"Marked notification as sent: {teacher_id} - {subject_name} ({reminder_type})")


async def get_teacher_push_subscription(teacher_id: str) -> Optional[Dict]:
    """
    Get teacher's Web Push subscription

    Returns:
        Push subscription object or None if not subscribed
    """
    # Check if teacher has push subscription
    user = await db.users.find_one({'id': teacher_id}, {'_id': 0, 'push_subscription': 1})

    if user and user.get('push_subscription'):
        return user['push_subscription']

    return None


async def send_push_notification(
    teacher_id: str,
    title: str,
    body: str,
    data: Dict
) -> bool:
    """
    Send Web Push notification to teacher

    Args:
        teacher_id: ID guru yang akan dinotifikasi
        title: Notification title
        body: Notification body
        data: Additional data (for deep link, etc)

    Returns:
        True if sent successfully
    """
    try:
        # Import push module
        from routers.push import send_push_to_users

        # Prepare notification payload
        payload = {
            'title': title,
            'body': body,
            'icon': '/icon-192.png',
            'badge': '/icon-192.png',
            'data': data,
            'requireInteraction': True,  # Keep notification visible
            'actions': [
                {
                    'action': 'scan',
                    'title': 'Scan QR'
                },
                {
                    'action': 'journal',
                    'title': 'Buka Jurnal'
                }
            ]
        }

        # Send notification to user
        result = await send_push_to_users([teacher_id], payload)

        # Check if sent successfully
        if result.get('sent', 0) > 0:
            return True

        return False

    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        return False


async def process_schedule_notification(
    schedule: Dict,
    current_date: str,
    current_time: str,
    day: str,
    reminder_type: str,
    minutes_before: int = 0
):
    """
    Process and send notification for a schedule

    Args:
        schedule: Schedule document
        current_date: Current date (YYYY-MM-DD)
        current_time: Current time (HH:MM)
        day: Current day in Indonesian
        reminder_type: 'before' or 'start'
        minutes_before: Minutes before class starts (for 'before' type)
    """
    teacher_id = schedule.get('teacher_id')
    schedule_id = schedule.get('id')
    start_time = schedule.get('start_time', '')

    if not teacher_id or not schedule_id:
        return

    # Check if already sent
    already_sent = await check_if_already_sent(
        schedule_id,
        teacher_id,
        current_date,
        reminder_type
    )

    if already_sent:
        logger.debug(f"Notification already sent for {schedule_id} ({reminder_type})")
        return

    # Get teacher info
    teacher = await db.users.find_one({'id': teacher_id}, {'_id': 0, 'full_name': 1})
    teacher_name = teacher.get('full_name', 'Guru') if teacher else 'Guru'

    # Get class, subject, room info
    class_doc = await db.classes.find_one({'id': schedule.get('class_id')}, {'_id': 0, 'name': 1})
    subject_doc = await db.subjects.find_one({'id': schedule.get('subject_id')}, {'_id': 0, 'name': 1})
    room_doc = await db.rooms.find_one({'id': schedule.get('room_id')}, {'_id': 0, 'name': 1})

    class_name = class_doc.get('name') if class_doc else 'Kelas'
    subject_name = subject_doc.get('name') if subject_doc else 'Mata Pelajaran'
    room_name = room_doc.get('name') if room_doc else 'Ruangan'

    # Check if teacher has push subscription
    # Note: send_push_to_users will handle checking subscriptions internally

    # Prepare notification message
    end_time = schedule.get('end_time', '')

    if reminder_type == 'before':
        title = f"⏰ {minutes_before} Menit Lagi"
        body = f"Waktunya mengajar: {subject_name} di {class_name}\nJam {start_time}–{end_time}, Ruang {room_name}"
    else:  # 'start'
        title = "🔔 Waktunya Mengajar!"
        body = f"{subject_name} di {class_name}\nJam {start_time}–{end_time}, Ruang {room_name}"

    # Prepare deep link data
    data = {
        'action': 'teaching_reminder',
        'schedule_id': schedule_id,
        'url': f'/jurnal/scan?schedule_id={schedule_id}',
        'class_name': class_name,
        'subject_name': subject_name,
        'room_name': room_name,
        'start_time': start_time,
        'end_time': end_time
    }

    # Send push notification
    success = await send_push_notification(teacher_id, title, body, data)

    if success:
        logger.info(f"✓ Sent {reminder_type} notification to {teacher_name} for {subject_name}")
    else:
        logger.warning(f"✗ Failed to send notification to {teacher_id}")

    # Mark as sent (even if failed, to avoid spam)
    await mark_as_sent(
        schedule_id, teacher_id, current_date, day, start_time,
        reminder_type, class_name, subject_name, room_name, minutes_before
    )


async def check_and_send_reminders():
    """
    Main function: Check schedules and send reminders
    Called every minute by scheduler
    """
    try:
        # Get current WIB time
        current_date, current_time, current_hour, current_minute = await get_current_time_wib()
        day = await get_current_day_indonesian()

        logger.info(f"⏰ Checking reminders for {day} {current_time}")

        # Get active semester
        from core import get_active_context
        ctx = await get_active_context(None)
        semester_id = ctx.get('semester_id')

        if not semester_id:
            logger.warning("No active semester found")
            return

        # Get all schedules for today
        schedules = await db.schedules.find({
            'semester_id': semester_id,
            'day': day
        }, {'_id': 0}).to_list(1000)

        logger.info(f"📅 Found {len(schedules)} schedules for {day}")

        # Process each schedule
        for schedule in schedules:
            start_time = schedule.get('start_time', '')

            if not start_time or ':' not in start_time:
                continue

            # Parse start time
            try:
                start_hour, start_minute = map(int, start_time.split(':'))
            except:
                continue

            # Check if we need to send "10 minutes before" notification
            # Calculate time 10 minutes before
            reminder_time = datetime.now().replace(
                hour=start_hour,
                minute=start_minute,
                second=0,
                microsecond=0
            ) - timedelta(minutes=10)

            reminder_hour = reminder_time.hour
            reminder_minute = reminder_time.minute

            # If current time matches reminder time (10 minutes before)
            if current_hour == reminder_hour and current_minute == reminder_minute:
                logger.info(f"⏰ Matched 10-min reminder: {start_time} for schedule {schedule.get('id')}")
                await process_schedule_notification(
                    schedule,
                    current_date,
                    current_time,
                    day,
                    'before',
                    minutes_before=10
                )

            # Check if we need to send "start time" notification
            if current_hour == start_hour and current_minute == start_minute:
                logger.info(f"🔔 Matched start time: {start_time} for schedule {schedule.get('id')}")
                await process_schedule_notification(
                    schedule,
                    current_date,
                    current_time,
                    day,
                    'start'
                )

        logger.debug(f"Finished checking reminders for {current_time}")

    except Exception as e:
        logger.error(f"Error in check_and_send_reminders: {e}", exc_info=True)


async def cleanup_old_reminders():
    """
    Cleanup old reminder records (keep only last 7 days)
    Run once per day
    """
    try:
        cutoff_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')

        result = await db.teaching_reminders.delete_many({
            'date': {'$lt': cutoff_date}
        })

        logger.info(f"Cleaned up {result.deleted_count} old reminder records")

    except Exception as e:
        logger.error(f"Error in cleanup_old_reminders: {e}")


# Scheduler task
async def start_reminder_scheduler():
    """
    Start the teaching reminder scheduler
    Runs every minute
    """
    logger.info("🔔 Teaching reminder scheduler started")

    while True:
        try:
            await check_and_send_reminders()

            # Sleep for 60 seconds
            await asyncio.sleep(60)

        except Exception as e:
            logger.error(f"Scheduler error: {e}", exc_info=True)
            await asyncio.sleep(60)


# Cleanup task (runs once per day)
async def start_cleanup_task():
    """
    Start daily cleanup task
    Runs at 2 AM every day
    """
    logger.info("🧹 Cleanup task started")

    while True:
        try:
            # Wait until 2 AM
            now = now_wib()
            target_time = now.replace(hour=2, minute=0, second=0, microsecond=0)

            if now > target_time:
                # If past 2 AM today, schedule for tomorrow
                target_time += timedelta(days=1)

            sleep_seconds = (target_time - now).total_seconds()

            logger.info(f"Next cleanup in {sleep_seconds/3600:.1f} hours")
            await asyncio.sleep(sleep_seconds)

            # Run cleanup
            await cleanup_old_reminders()

        except Exception as e:
            logger.error(f"Cleanup task error: {e}", exc_info=True)
            await asyncio.sleep(3600)  # Retry in 1 hour
