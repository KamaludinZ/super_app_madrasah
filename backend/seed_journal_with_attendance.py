"""
Seeder untuk membuat data jurnal dengan attendance details lengkap
Untuk testing fitur detail kehadiran siswa
"""
import asyncio
import uuid
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def seed_journal_with_attendance():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client['super_app_madrasah']

    print("Starting journal seeding with attendance details...")

    # Get active semester and academic year
    semester = await db.semesters.find_one({'is_active': True})
    if not semester:
        print("ERROR: No active semester found")
        return

    academic_year = await db.academic_years.find_one({'id': semester['academic_year_id']})

    print(f"Found active semester: {semester['name']} - {academic_year['name']}")

    # Get kelas 7A (from previous conversation we know this class exists)
    class_7a = await db.classes.find_one({'name': '7A'})
    if not class_7a:
        print("ERROR: Class 7A not found")
        return

    print(f"Found class: {class_7a['name']}")

    # Get students from class 7A
    students = await db.students.find({
        'class_id': class_7a['id'],
        'is_active': True
    }).to_list(100)

    if not students:
        print("ERROR: No students found in class 7A")
        return

    print(f"Found {len(students)} students in class 7A")

    # Get schedules for class 7A
    schedules = await db.schedules.find({
        'class_id': class_7a['id'],
        'semester_id': semester['id']
    }).limit(3).to_list(3)

    if not schedules:
        print("ERROR: No schedules found for class 7A")
        return

    print(f"Found {len(schedules)} schedules for class 7A")

    # Create journals with attendance details
    journals_created = 0

    for idx, schedule in enumerate(schedules):
        # Get teacher info
        teacher = await db.users.find_one({'id': schedule['teacher_id']})
        if not teacher:
            continue

        # Get subject info
        subject = await db.subjects.find_one({'id': schedule['subject_id']})
        if not subject:
            continue

        # Get room info
        room = await db.rooms.find_one({'id': schedule['room_id']})
        if not room:
            continue

        # Create journal ID
        journal_id = str(uuid.uuid4())

        # Calculate date (today - idx days)
        journal_date = datetime.now() - timedelta(days=idx)

        # Distribute students to attendance statuses
        # Example: 80% hadir, 10% sakit, 5% izin, 5% alpha
        total_students = len(students)
        hadir_count = int(total_students * 0.8)
        sakit_count = int(total_students * 0.1)
        izin_count = int(total_students * 0.05)
        alpha_count = total_students - hadir_count - sakit_count - izin_count

        # Create attendance details
        attendance_details = []
        student_idx = 0

        # Hadir
        for i in range(hadir_count):
            if student_idx < len(students):
                attendance_details.append({
                    'student_id': students[student_idx]['id'],
                    'student_name': students[student_idx].get('full_name', students[student_idx].get('username')),
                    'status': 'hadir'
                })
                student_idx += 1

        # Sakit
        for i in range(sakit_count):
            if student_idx < len(students):
                attendance_details.append({
                    'student_id': students[student_idx]['id'],
                    'student_name': students[student_idx].get('full_name', students[student_idx].get('username')),
                    'status': 'sakit'
                })
                student_idx += 1

        # Izin
        for i in range(izin_count):
            if student_idx < len(students):
                attendance_details.append({
                    'student_id': students[student_idx]['id'],
                    'student_name': students[student_idx].get('full_name', students[student_idx].get('username')),
                    'status': 'izin'
                })
                student_idx += 1

        # Alpha
        for i in range(alpha_count):
            if student_idx < len(students):
                attendance_details.append({
                    'student_id': students[student_idx]['id'],
                    'student_name': students[student_idx].get('full_name', students[student_idx].get('username')),
                    'status': 'alpha'
                })
                student_idx += 1

        # Create journal document
        journal_doc = {
            'id': journal_id,
            'schedule_id': schedule['id'],
            'teacher_id': schedule['teacher_id'],
            'class_id': class_7a['id'],
            'subject_id': schedule['subject_id'],
            'room_id': schedule['room_id'],
            'semester_id': semester['id'],
            'materi': f"Materi {subject['name']} - Pertemuan {idx + 1}",
            'catatan': f"Pembelajaran berjalan lancar. Total siswa: {total_students}",
            'siswa_hadir': hadir_count,
            'siswa_sakit': sakit_count,
            'siswa_izin': izin_count,
            'siswa_tidak_hadir': alpha_count,
            'attendance_details': attendance_details,
            'scheduled_start': schedule.get('start_time'),
            'scheduled_end': schedule.get('end_time'),
            'started_at': journal_date.isoformat(),
            'created_at': journal_date.isoformat(),
            'is_locked': False,
            'qr_mode': 'static',
            'fill_mode': 'normal',
            'validations': {
                'qr': {'valid': True},
                'schedule': {'valid': True},
                'gps': {'valid': True}
            }
        }

        # Insert journal
        await db.journals.insert_one(journal_doc)

        # Insert individual attendance records to attendances collection
        attendance_docs = []
        for att in attendance_details:
            att_id = str(uuid.uuid4())
            attendance_docs.append({
                'id': att_id,
                'journal_id': journal_id,
                'student_id': att['student_id'],
                'student_name': att['student_name'],
                'status': att['status'],
                'created_at': journal_date.isoformat()
            })

        if attendance_docs:
            await db.attendances.insert_many(attendance_docs)

        journals_created += 1
        print(f"Created journal for {subject['name']} by {teacher.get('full_name', teacher.get('username'))}")
        print(f"  - Hadir: {hadir_count}, Sakit: {sakit_count}, Izin: {izin_count}, Alpha: {alpha_count}")
        print(f"  - Saved {len(attendance_docs)} attendance records")

    client.close()
    print(f"\nSeeding complete! Created {journals_created} journals with attendance details")

if __name__ == "__main__":
    asyncio.run(seed_journal_with_attendance())
