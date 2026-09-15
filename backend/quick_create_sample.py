"""
Quick script to create sample materi and tugas for siswa.
This uses the same MongoDB connection as the main app.
"""
import asyncio
import sys
from datetime import datetime, timedelta
import uuid

# Import from your existing code
from core import db

async def create_sample_data():
    """Create sample materi and tugas for testing."""

    print("=" * 60)
    print("CREATING SAMPLE MATERI & TUGAS FOR SISWA")
    print("=" * 60)

    # 1. Get active semester
    semester = await db.semesters.find_one({'is_active': True})
    if not semester:
        print("ERROR: No active semester found!")
        return

    print(f"\n[OK] Active semester: {semester.get('name')}")
    semester_id = semester['id']
    academic_year_id = semester.get('academic_year_id')

    # 2. Get a teacher (guru)
    teacher = await db.users.find_one({'roles': 'guru', 'is_active': True})
    if not teacher:
        print("ERROR: No active teacher found!")
        return

    print(f"✓ Teacher: {teacher.get('full_name')} ({teacher.get('username')})")
    teacher_id = teacher['id']

    # 3. Get a subject
    subject = await db.subjects.find_one({})
    if not subject:
        print("ERROR: No subject found!")
        return

    print(f"✓ Subject: {subject.get('name')}")
    subject_id = subject['id']

    # 4. Get a class
    kelas = await db.classes.find_one({'semester_id': semester_id})
    if not kelas:
        print("ERROR: No class found for this semester!")
        return

    print(f"✓ Class: {kelas.get('name')}")
    class_id = kelas['id']

    # 5. Get a student from this class
    student = await db.users.find_one({
        'roles': 'siswa',
        'student_class_id': class_id,
        'is_active': True
    })
    if not student:
        print("ERROR: No student found in this class!")
        return

    print(f"✓ Student: {student.get('full_name')} (ID: {student['id']})")
    print(f"  Class ID: {student.get('student_class_id')}")
    student_id = student['id']

    print("\n" + "=" * 60)
    print("CREATING SAMPLE DATA...")
    print("=" * 60)

    # 6. Create MATERI for KELAS
    materi_kelas_id = str(uuid.uuid4())
    materi_kelas = {
        'id': materi_kelas_id,
        'judul': 'Materi Kelas - Pengenalan Aljabar',
        'deskripsi': 'Materi pengenalan aljabar untuk seluruh kelas',
        'konten': '<h2>Pengenalan Aljabar</h2><p>Aljabar adalah cabang matematika yang mempelajari struktur, relasi, dan kuantitas.</p>',
        'file_url': 'https://example.com/aljabar-kelas.pdf',
        'target_role': 'kelas',
        'target_kelas_ids': [class_id],
        'target_siswa': [],
        'teacher_id': teacher_id,
        'subject_id': subject_id,
        'semester_id': semester_id,
        'academic_year_id': academic_year_id,
        'created_at': datetime.utcnow(),
        'updated_at': None,
        'is_active': True
    }
    await db.materi_mapel.insert_one(materi_kelas)
    print(f"\n✓ Created MATERI for KELAS: {materi_kelas['judul']}")
    print(f"  ID: {materi_kelas_id}")
    print(f"  target_role: 'kelas'")
    print(f"  target_kelas_ids: {materi_kelas['target_kelas_ids']}")

    # 7. Create MATERI for SISWA (specific student)
    materi_siswa_id = str(uuid.uuid4())
    materi_siswa = {
        'id': materi_siswa_id,
        'judul': 'Materi Khusus Siswa - Remedial Aljabar',
        'deskripsi': 'Materi remedial khusus untuk siswa tertentu',
        'konten': '<h2>Remedial Aljabar</h2><p>Latihan tambahan untuk memperdalam pemahaman aljabar.</p>',
        'file_url': 'https://example.com/remedial-aljabar.pdf',
        'target_role': 'siswa',
        'target_kelas_ids': [],
        'target_siswa': [student_id],  # Array containing student ID
        'teacher_id': teacher_id,
        'subject_id': subject_id,
        'semester_id': semester_id,
        'academic_year_id': academic_year_id,
        'created_at': datetime.utcnow(),
        'updated_at': None,
        'is_active': True
    }
    await db.materi_mapel.insert_one(materi_siswa)
    print(f"\n✓ Created MATERI for SISWA: {materi_siswa['judul']}")
    print(f"  ID: {materi_siswa_id}")
    print(f"  target_role: 'siswa'")
    print(f"  target_siswa: {materi_siswa['target_siswa']}")

    # 8. Create TUGAS for KELAS
    tugas_kelas_id = str(uuid.uuid4())
    deadline_kelas = (datetime.utcnow() + timedelta(days=7)).isoformat()
    tugas_kelas = {
        'id': tugas_kelas_id,
        'judul': 'Tugas Kelas - Latihan Aljabar',
        'deskripsi': 'Kerjakan soal-soal aljabar berikut',
        'konten': '<h2>Soal Latihan</h2><ol><li>Selesaikan: 2x + 5 = 15</li><li>Tentukan nilai y: 3y - 7 = 20</li></ol>',
        'file_url': 'https://example.com/tugas-aljabar-kelas.pdf',
        'deadline': deadline_kelas,
        'target_role': 'kelas',
        'target_kelas_ids': [class_id],
        'target_siswa': [],
        'teacher_id': teacher_id,
        'subject_id': subject_id,
        'semester_id': semester_id,
        'academic_year_id': academic_year_id,
        'created_at': datetime.utcnow(),
        'updated_at': None,
        'is_active': True
    }
    await db.tugas.insert_one(tugas_kelas)
    print(f"\n✓ Created TUGAS for KELAS: {tugas_kelas['judul']}")
    print(f"  ID: {tugas_kelas_id}")
    print(f"  target_role: 'kelas'")
    print(f"  target_kelas_ids: {tugas_kelas['target_kelas_ids']}")
    print(f"  deadline: {deadline_kelas}")

    # 9. Create TUGAS for SISWA (specific student)
    tugas_siswa_id = str(uuid.uuid4())
    deadline_siswa = (datetime.utcnow() + timedelta(days=3)).isoformat()
    tugas_siswa = {
        'id': tugas_siswa_id,
        'judul': 'Tugas Khusus Siswa - Latihan Remedial',
        'deskripsi': 'Latihan tambahan untuk remedial',
        'konten': '<h2>Latihan Remedial</h2><p>Kerjakan soal-soal berikut untuk memperdalam pemahaman.</p>',
        'file_url': 'https://example.com/tugas-remedial.pdf',
        'deadline': deadline_siswa,
        'target_role': 'siswa',
        'target_kelas_ids': [],
        'target_siswa': [student_id],  # Array containing student ID
        'teacher_id': teacher_id,
        'subject_id': subject_id,
        'semester_id': semester_id,
        'academic_year_id': academic_year_id,
        'created_at': datetime.utcnow(),
        'updated_at': None,
        'is_active': True
    }
    await db.tugas.insert_one(tugas_siswa)
    print(f"\n✓ Created TUGAS for SISWA: {tugas_siswa['judul']}")
    print(f"  ID: {tugas_siswa_id}")
    print(f"  target_role: 'siswa'")
    print(f"  target_siswa: {tugas_siswa['target_siswa']}")
    print(f"  deadline: {deadline_siswa}")

    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    # Verify data
    total_materi = await db.materi_mapel.count_documents({'is_active': True})
    total_tugas = await db.tugas.count_documents({'is_active': True})

    print(f"\n✓ Total active MATERI in database: {total_materi}")
    print(f"✓ Total active TUGAS in database: {total_tugas}")

    # Test queries that will be used by API
    print(f"\n" + "=" * 60)
    print(f"TESTING API QUERIES FOR STUDENT: {student.get('full_name')}")
    print("=" * 60)

    # Test materi kelas query
    materi_kelas_count = await db.materi_mapel.count_documents({
        'is_active': True,
        'target_role': 'kelas',
        'target_kelas_ids': class_id
    })
    print(f"\nMateri for KELAS (class_id={class_id}): {materi_kelas_count}")

    # Test materi siswa query
    materi_siswa_count = await db.materi_mapel.count_documents({
        'is_active': True,
        'target_role': 'siswa',
        'target_siswa': student_id
    })
    print(f"Materi for SISWA (student_id={student_id}): {materi_siswa_count}")

    # Test tugas kelas query
    tugas_kelas_count = await db.tugas.count_documents({
        'is_active': True,
        'target_role': 'kelas',
        'target_kelas_ids': class_id
    })
    print(f"\nTugas for KELAS (class_id={class_id}): {tugas_kelas_count}")

    # Test tugas siswa query
    tugas_siswa_count = await db.tugas.count_documents({
        'is_active': True,
        'target_role': 'siswa',
        'target_siswa': student_id
    })
    print(f"Tugas for SISWA (student_id={student_id}): {tugas_siswa_count}")

    print("\n" + "=" * 60)
    print("SUCCESS! Sample data created.")
    print("=" * 60)
    print(f"\nNow you can:")
    print(f"1. Login as student: {student.get('username')}")
    print(f"2. Go to /siswa/materi:")
    print(f"   - Tab 'Materi Kelas' should show: {materi_kelas_count} item(s)")
    print(f"   - Tab 'Materi Siswa' should show: {materi_siswa_count} item(s)")
    print(f"3. Go to /siswa/tugas:")
    print(f"   - Tab 'Tugas Kelas' should show: {tugas_kelas_count} item(s)")
    print(f"   - Tab 'Tugas Siswa' should show: {tugas_siswa_count} item(s)")
    print()

if __name__ == '__main__':
    try:
        asyncio.run(create_sample_data())
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
