"""
Script untuk membuat sample materi dan tugas untuk testing.
Run dengan: python create_sample_materi_tugas.py
"""
import asyncio
import sys
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

# MongoDB connection
MONGODB_URL = "mongodb://admin:admin123@localhost:27017/super_app_madrasah?authSource=admin"

async def create_sample_data():
    """Create sample materi and tugas for testing."""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client.super_app_madrasah

    print("=" * 60)
    print("CREATING SAMPLE MATERI & TUGAS DATA")
    print("=" * 60)

    # 1. Get active semester
    semester = await db.semesters.find_one({'is_active': True})
    if not semester:
        print("❌ No active semester found!")
        return

    print(f"\n✓ Active semester: {semester.get('name')}")
    semester_id = semester['id']
    academic_year_id = semester.get('academic_year_id')

    # 2. Get a teacher (guru)
    teacher = await db.users.find_one({'roles': 'guru', 'is_active': True})
    if not teacher:
        print("❌ No active teacher found!")
        return

    print(f"✓ Teacher: {teacher.get('full_name')} ({teacher.get('username')})")
    teacher_id = teacher['id']

    # 3. Get a subject
    subject = await db.subjects.find_one({})
    if not subject:
        print("❌ No subject found!")
        return

    print(f"✓ Subject: {subject.get('name')}")
    subject_id = subject['id']

    # 4. Get a class
    kelas = await db.classes.find_one({'semester_id': semester_id})
    if not kelas:
        print("❌ No class found for this semester!")
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
        print("❌ No student found in this class!")
        return

    print(f"✓ Student: {student.get('full_name')} (class_id: {student.get('student_class_id')})")
    student_id = student['id']

    print("\n" + "=" * 60)
    print("CREATING MATERI...")
    print("=" * 60)

    # 6. Create sample MATERI for KELAS
    materi_kelas = {
        'id': str(uuid.uuid4()),
        'judul': 'Materi Matematika - Aljabar Dasar',
        'deskripsi': 'Pengenalan dasar aljabar untuk kelas',
        'konten': '<h2>Aljabar Dasar</h2><p>Materi ini membahas tentang variabel, konstanta, dan operasi dasar aljabar.</p>',
        'file_url': 'https://example.com/materi-aljabar.pdf',
        'target_role': 'kelas',  # String, bukan array!
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

    result = await db.materi_mapel.insert_one(materi_kelas)
    print(f"✓ Created MATERI for KELAS: {materi_kelas['judul']}")
    print(f"  - ID: {materi_kelas['id']}")
    print(f"  - Target: kelas")
    print(f"  - Class IDs: {materi_kelas['target_kelas_ids']}")

    # 7. Create sample MATERI for SISWA
    materi_siswa = {
        'id': str(uuid.uuid4()),
        'judul': 'Materi Khusus - Remedial Matematika',
        'deskripsi': 'Materi remedial khusus untuk siswa tertentu',
        'konten': '<h2>Remedial</h2><p>Materi ini khusus untuk siswa yang perlu remedial.</p>',
        'file_url': 'https://example.com/materi-remedial.pdf',
        'target_role': 'siswa',  # String, bukan array!
        'target_kelas_ids': [],
        'target_siswa': [student_id],  # Array of student IDs
        'teacher_id': teacher_id,
        'subject_id': subject_id,
        'semester_id': semester_id,
        'academic_year_id': academic_year_id,
        'created_at': datetime.utcnow(),
        'updated_at': None,
        'is_active': True
    }

    result = await db.materi_mapel.insert_one(materi_siswa)
    print(f"\n✓ Created MATERI for SISWA: {materi_siswa['judul']}")
    print(f"  - ID: {materi_siswa['id']}")
    print(f"  - Target: siswa")
    print(f"  - Student IDs: {materi_siswa['target_siswa']}")

    print("\n" + "=" * 60)
    print("CREATING TUGAS...")
    print("=" * 60)

    # 8. Create sample TUGAS for KELAS
    deadline_kelas = (datetime.utcnow() + timedelta(days=7)).isoformat()
    tugas_kelas = {
        'id': str(uuid.uuid4()),
        'judul': 'Tugas Matematika - Soal Aljabar',
        'deskripsi': 'Kerjakan 10 soal aljabar dasar',
        'konten': '<h2>Soal Aljabar</h2><ol><li>Selesaikan 2x + 5 = 15</li><li>Tentukan nilai y jika 3y - 7 = 20</li></ol>',
        'file_url': 'https://example.com/tugas-aljabar.pdf',
        'deadline': deadline_kelas,
        'target_role': 'kelas',  # String, bukan array!
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

    result = await db.tugas.insert_one(tugas_kelas)
    print(f"✓ Created TUGAS for KELAS: {tugas_kelas['judul']}")
    print(f"  - ID: {tugas_kelas['id']}")
    print(f"  - Target: kelas")
    print(f"  - Class IDs: {tugas_kelas['target_kelas_ids']}")
    print(f"  - Deadline: {tugas_kelas['deadline']}")

    # 9. Create sample TUGAS for SISWA
    deadline_siswa = (datetime.utcnow() + timedelta(days=3)).isoformat()
    tugas_siswa = {
        'id': str(uuid.uuid4()),
        'judul': 'Tugas Remedial - Latihan Tambahan',
        'deskripsi': 'Latihan tambahan untuk remedial',
        'konten': '<h2>Latihan Remedial</h2><p>Kerjakan latihan tambahan ini untuk memperdalam pemahaman.</p>',
        'file_url': 'https://example.com/tugas-remedial.pdf',
        'deadline': deadline_siswa,
        'target_role': 'siswa',  # String, bukan array!
        'target_kelas_ids': [],
        'target_siswa': [student_id],  # Array of student IDs
        'teacher_id': teacher_id,
        'subject_id': subject_id,
        'semester_id': semester_id,
        'academic_year_id': academic_year_id,
        'created_at': datetime.utcnow(),
        'updated_at': None,
        'is_active': True
    }

    result = await db.tugas.insert_one(tugas_siswa)
    print(f"\n✓ Created TUGAS for SISWA: {tugas_siswa['judul']}")
    print(f"  - ID: {tugas_siswa['id']}")
    print(f"  - Target: siswa")
    print(f"  - Student IDs: {tugas_siswa['target_siswa']}")
    print(f"  - Deadline: {tugas_siswa['deadline']}")

    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    # Verify data
    total_materi = await db.materi_mapel.count_documents({'is_active': True})
    total_tugas = await db.tugas.count_documents({'is_active': True})

    print(f"\n✓ Total active MATERI in database: {total_materi}")
    print(f"✓ Total active TUGAS in database: {total_tugas}")

    # Check what student will see
    print(f"\n" + "=" * 60)
    print(f"WHAT STUDENT {student.get('full_name')} WILL SEE:")
    print("=" * 60)

    materi_for_student_kelas = await db.materi_mapel.find({
        'is_active': True,
        'target_role': 'kelas',
        'target_kelas_ids': class_id
    }).to_list(None)

    materi_for_student_siswa = await db.materi_mapel.find({
        'is_active': True,
        'target_role': 'siswa',
        'target_siswa': student_id
    }).to_list(None)

    print(f"\nMateri for KELAS ({class_id}): {len(materi_for_student_kelas)}")
    for m in materi_for_student_kelas:
        print(f"  - {m['judul']}")

    print(f"\nMateri for SISWA ({student_id}): {len(materi_for_student_siswa)}")
    for m in materi_for_student_siswa:
        print(f"  - {m['judul']}")

    tugas_for_student_kelas = await db.tugas.find({
        'is_active': True,
        'target_role': 'kelas',
        'target_kelas_ids': class_id
    }).to_list(None)

    tugas_for_student_siswa = await db.tugas.find({
        'is_active': True,
        'target_role': 'siswa',
        'target_siswa': student_id
    }).to_list(None)

    print(f"\nTugas for KELAS ({class_id}): {len(tugas_for_student_kelas)}")
    for t in tugas_for_student_kelas:
        print(f"  - {t['judul']}")

    print(f"\nTugas for SISWA ({student_id}): {len(tugas_for_student_siswa)}")
    for t in tugas_for_student_siswa:
        print(f"  - {t['judul']}")

    print("\n" + "=" * 60)
    print("✓ DONE! Sample data created successfully!")
    print("=" * 60)
    print("\nNow you can:")
    print(f"1. Login as student: {student.get('username')}")
    print(f"2. Go to /siswa/materi - should see 1 materi in each tab")
    print(f"3. Go to /siswa/tugas - should see 1 tugas in each tab")
    print("\n")

if __name__ == '__main__':
    try:
        asyncio.run(create_sample_data())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
