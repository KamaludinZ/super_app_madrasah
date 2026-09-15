"""
Script sederhana untuk seed attendance data
Jalankan dengan: python run_seed_attendance.py
"""
import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def seed_attendance():
    print("=" * 60)
    print("SEED ATTENDANCE DATA - Super App Madrasah")
    print("=" * 60)
    print()

    # Connect to MongoDB
    mongo_url = os.getenv('MONGODB_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['super_app_madrasah']

    try:
        # Test connection
        await db.command('ping')
        print("[OK] Koneksi ke MongoDB berhasil!")
        print()

        # Get all journals
        journals = await db.journals.find({}).to_list(1000)
        print(f"Total jurnal ditemukan: {len(journals)}")
        print()

        seeded_count = 0
        skipped_count = 0

        for journal in journals:
            journal_id = journal.get('id')

            # Check if already has attendance
            existing = await db.attendances.count_documents({'journal_id': journal_id})
            if existing > 0:
                print(f"[SKIP] Jurnal {journal_id[:8]}... sudah punya {existing} data kehadiran, dilewati")
                skipped_count += 1
                continue

            # Get students from class
            class_id = journal.get('class_id')
            if not class_id:
                print(f"[WARN] Jurnal {journal_id[:8]}... tidak punya class_id, dilewati")
                continue

            students = await db.students.find({
                'class_id': class_id,
                'is_active': True
            }, {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1}).to_list(1000)

            if not students:
                print(f"[WARN] Tidak ada siswa di kelas {class_id}, dilewati")
                continue

            # Get counts from journal
            hadir_count = journal.get('siswa_hadir', 0)
            sakit_count = journal.get('siswa_sakit', 0)
            izin_count = journal.get('siswa_izin', 0)
            alpha_count = journal.get('siswa_tidak_hadir', 0)

            # If all counts are 0, distribute evenly
            if hadir_count == 0 and sakit_count == 0 and izin_count == 0 and alpha_count == 0:
                total = len(students)
                hadir_count = int(total * 0.8)
                sakit_count = int(total * 0.1)
                izin_count = int(total * 0.05)
                alpha_count = total - hadir_count - sakit_count - izin_count

            # Create attendance records
            attendance_docs = []
            idx = 0

            # Hadir
            for i in range(hadir_count):
                if idx < len(students):
                    attendance_docs.append({
                        'id': str(uuid.uuid4()),
                        'journal_id': journal_id,
                        'student_id': students[idx]['id'],
                        'student_name': students[idx].get('full_name') or students[idx].get('username'),
                        'status': 'hadir',
                        'created_at': journal.get('created_at')
                    })
                    idx += 1

            # Sakit
            for i in range(sakit_count):
                if idx < len(students):
                    attendance_docs.append({
                        'id': str(uuid.uuid4()),
                        'journal_id': journal_id,
                        'student_id': students[idx]['id'],
                        'student_name': students[idx].get('full_name') or students[idx].get('username'),
                        'status': 'sakit',
                        'created_at': journal.get('created_at')
                    })
                    idx += 1

            # Izin
            for i in range(izin_count):
                if idx < len(students):
                    attendance_docs.append({
                        'id': str(uuid.uuid4()),
                        'journal_id': journal_id,
                        'student_id': students[idx]['id'],
                        'student_name': students[idx].get('full_name') or students[idx].get('username'),
                        'status': 'izin',
                        'created_at': journal.get('created_at')
                    })
                    idx += 1

            # Alpha
            for i in range(alpha_count):
                if idx < len(students):
                    attendance_docs.append({
                        'id': str(uuid.uuid4()),
                        'journal_id': journal_id,
                        'student_id': students[idx]['id'],
                        'student_name': students[idx].get('full_name') or students[idx].get('username'),
                        'status': 'alpha',
                        'created_at': journal.get('created_at')
                    })
                    idx += 1

            # Insert to database
            if attendance_docs:
                await db.attendances.insert_many(attendance_docs)
                print(f"[OK] Jurnal {journal_id[:8]}... -> {len(attendance_docs)} data kehadiran berhasil dibuat")
                print(f"     Hadir: {hadir_count}, Sakit: {sakit_count}, Izin: {izin_count}, Alpha: {alpha_count}")
                seeded_count += 1

            # Update journal counts
            await db.journals.update_one(
                {'id': journal_id},
                {'$set': {
                    'siswa_hadir': hadir_count,
                    'siswa_sakit': sakit_count,
                    'siswa_izin': izin_count,
                    'siswa_tidak_hadir': alpha_count
                }}
            )

        print()
        print("=" * 60)
        print("SEEDING SELESAI!")
        print("=" * 60)
        print(f"[OK] Total jurnal di-seed: {seeded_count}")
        print(f"[SKIP] Total jurnal dilewati: {skipped_count}")
        print(f"[INFO] Total jurnal: {len(journals)}")
        print()
        print("Silakan refresh halaman jurnal dan klik tombol Detail!")
        print("=" * 60)

    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(seed_attendance())
