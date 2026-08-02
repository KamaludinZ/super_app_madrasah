"""
Complete Data Seeder for All Features
Includes: Users, Siswa, Guru, Tendik, Jadwal, Jurnal, Kehadiran, RKAM, Holidays, etc.
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from motor.motor_asyncio import AsyncIOMotorClient
from auth_utils import hash_password
import random

WIB_TZ = timezone(timedelta(hours=7))

def now_wib():
    return datetime.now(WIB_TZ)

def make_user(username, password, full_name, roles, **kw):
    return {
        'id': str(uuid.uuid4()),
        'username': username,
        'password_hash': hash_password(password),
        'full_name': full_name,
        'roles': roles,
        'is_active': True,
        'created_at': datetime.utcnow(),
        **kw,
    }

async def seed_all_data(db: Any):
    """Seed all comprehensive data"""

    print("\n" + "="*60)
    print("SEEDING ALL APPLICATION DATA")
    print("="*60 + "\n")

    current_year = "2025/2026"
    fiscal_year = "2025/2026"

    # ============================================================
    # 1. SETTINGS
    # ============================================================
    print("[1/15] Settings...")
    settings_exists = await db.settings.find_one({'id': 'global_config'})
    if not settings_exists:
        settings = {
            'id': 'global_config',
            'app_name': 'Super Apps MATSANDATAMA',
            'school_name': 'MTsN 2 Kota Malang',
            'npsn': '20533771',
            'accreditation': 'A',
            'headmaster_name': 'H. Mohammad Husnan, M.Pd',
            'address': 'Jl. Cemorokandang No.77, Kedungkandang, Kota Malang',
            'phone': '(0341) 712073',
            'email': 'info@mtsn2kotamalang.sch.id',
            'logo_url': None,
            'primary_color': '#006837',
            'gps_default_enabled': True,
            'gps_default_radius': 30.0,
            'qr_default_mode': 'static',
            'grace_minutes': 15,
            'updated_at': datetime.utcnow(),
        }
        await db.settings.insert_one(settings)
        print("   -> Settings created")
    else:
        print("   -> Settings already exists")

    # ============================================================
    # 2. ACADEMIC YEAR & SEMESTER
    # ============================================================
    print("[2/15] Academic Year & Semester...")
    ay_exists = await db.academic_years.find_one({'name': current_year})
    if not ay_exists:
        ay_id = str(uuid.uuid4())
        academic_year = {
            'id': ay_id,
            'name': current_year,
            'start_date': '2025-07-14',
            'end_date': '2026-06-20',
            'is_active': True,
            'created_at': datetime.utcnow(),
        }
        await db.academic_years.insert_one(academic_year)
        print(f"   -> Academic year {current_year} created")
    else:
        ay_id = ay_exists['id']
        print(f"   -> Academic year {current_year} already exists")

    # Semesters
    semesters = [
        {'id': str(uuid.uuid4()), 'name': 'Ganjil', 'academic_year_id': ay_id, 'start_date': '2025-07-14', 'end_date': '2025-12-20', 'is_active': True},
        {'id': str(uuid.uuid4()), 'name': 'Genap', 'academic_year_id': ay_id, 'start_date': '2026-01-05', 'end_date': '2026-06-20', 'is_active': False},
    ]
    for sem in semesters:
        exists = await db.semesters.find_one({'name': sem['name'], 'academic_year_id': ay_id})
        if not exists:
            await db.semesters.insert_one(sem)
    print("   -> 2 semesters created")

    # ============================================================
    # 3. USERS (Admin, Guru, Tendik, Siswa)
    # ============================================================
    print("[3/15] Users (Admin, Guru, Tendik, Siswa)...")

    # Admin
    admin_exists = await db.users.find_one({'username': 'admin'})
    if not admin_exists:
        admin = make_user('admin', 'admin123', 'Administrator', ['admin'], email='admin@mtsn2malang.sch.id')
        await db.users.insert_one(admin)
        print("   -> Admin created")

    # Guru
    guru_data = [
        ('guru1', 'Dra. Siti Aminah, M.Pd', 'siti.aminah@mtsn2malang.sch.id', 'P', '197001051995032001'),
        ('guru2', 'Ahmad Fauzi, S.Pd', 'ahmad.fauzi@mtsn2malang.sch.id', 'L', '198205122006041002'),
        ('guru3', 'Nurlaila Hidayati, S.Pd.I', 'nurlaila@mtsn2malang.sch.id', 'P', '198709152010012003'),
        ('guru4', 'Muhammad Hasan, S.Pd', 'hasan@mtsn2malang.sch.id', 'L', '199002282015031004'),
        ('guru5', 'Dewi Kartika, S.Pd', 'dewi.kartika@mtsn2malang.sch.id', 'P', '199205102017012001'),
    ]

    guru_ids = []
    for username, name, email, gender, nip in guru_data:
        exists = await db.users.find_one({'username': username})
        if not exists:
            guru = make_user(username, 'guru123', name, ['guru'],
                           email=email, nip=nip, gender=gender, phone='08123456789')
            await db.users.insert_one(guru)
            guru_ids.append(guru['id'])
        else:
            guru_ids.append(exists['id'])
    print(f"   -> {len(guru_data)} guru created")

    # Tendik
    tendik_data = [
        ('tendik1', 'Budi Santoso', 'budi@mtsn2malang.sch.id', 'L', '198801152010011001'),
        ('tendik2', 'Rina Susanti', 'rina@mtsn2malang.sch.id', 'P', '199003202012012001'),
    ]

    for username, name, email, gender, nip in tendik_data:
        exists = await db.users.find_one({'username': username})
        if not exists:
            tendik = make_user(username, 'tendik123', name, ['tenaga_kependidikan'],
                             email=email, nip=nip, gender=gender)
            await db.users.insert_one(tendik)
    print(f"   -> {len(tendik_data)} tendik created")

    # ============================================================
    # 4. CLASSES & ROOMS
    # ============================================================
    print("[4/15] Classes & Rooms...")

    classes_data = [
        ('7A', 7), ('7B', 7), ('7C', 7),
        ('8A', 8), ('8B', 8), ('8C', 8),
        ('9A', 9), ('9B', 9), ('9C', 9),
    ]

    class_ids = {}
    for class_name, grade in classes_data:
        exists = await db.classes.find_one({'name': class_name, 'academic_year_id': ay_id})
        if not exists:
            class_id = str(uuid.uuid4())
            kelas = {
                'id': class_id,
                'name': class_name,
                'grade': grade,
                'academic_year_id': ay_id,
                'homeroom_teacher_id': random.choice(guru_ids) if guru_ids else None,
                'is_active': True,
                'created_at': datetime.utcnow(),
            }
            await db.classes.insert_one(kelas)
            class_ids[class_name] = class_id
        else:
            class_ids[class_name] = exists['id']
    print(f"   -> {len(classes_data)} classes created")

    # Rooms
    rooms_data = ['R-7A', 'R-7B', 'R-7C', 'R-8A', 'R-8B', 'R-8C', 'R-9A', 'R-9B', 'R-9C', 'Lab Komputer', 'Lab IPA', 'Perpustakaan']
    room_ids = {}
    for room_name in rooms_data:
        exists = await db.rooms.find_one({'name': room_name})
        if not exists:
            room_id = str(uuid.uuid4())
            room = {
                'id': room_id,
                'name': room_name,
                'capacity': 32 if 'R-' in room_name else 40,
                'is_active': True,
                'created_at': datetime.utcnow(),
            }
            await db.rooms.insert_one(room)
            room_ids[room_name] = room_id
        else:
            room_ids[room_name] = exists['id']
    print(f"   -> {len(rooms_data)} rooms created")

    # ============================================================
    # 5. STUDENTS (Siswa)
    # ============================================================
    print("[5/15] Students (30 siswa)...")

    students_data = []
    nisn_start = 1234567890
    for i in range(30):
        grade = 7 + (i // 10)
        class_suffix = chr(65 + (i % 3))  # A, B, C
        class_name = f"{grade}{class_suffix}"

        gender = 'L' if i % 2 == 0 else 'P'
        first_names_l = ['Ahmad', 'Muhammad', 'Rizki', 'Farhan', 'Ilham', 'Dimas', 'Arif', 'Budi', 'Eko', 'Faisal']
        first_names_p = ['Siti', 'Nur', 'Dewi', 'Aisyah', 'Fatimah', 'Rahma', 'Zahra', 'Putri', 'Lina', 'Maya']
        last_names = ['Pratama', 'Hidayat', 'Santoso', 'Wijaya', 'Permana', 'Saputra', 'Kusuma', 'Firmansyah', 'Nugroho', 'Ramadhan']

        first_name = random.choice(first_names_l if gender == 'L' else first_names_p)
        last_name = random.choice(last_names)
        full_name = f"{first_name} {last_name}"

        nisn = str(nisn_start + i)
        username = f"siswa{i+1}"

        students_data.append({
            'username': username,
            'full_name': full_name,
            'nisn': nisn,
            'class_name': class_name,
            'gender': gender,
        })

    siswa_ids = []
    for student in students_data:
        user_exists = await db.users.find_one({'username': student['username']})
        if not user_exists:
            siswa_user = make_user(
                student['username'],
                'siswa123',
                student['full_name'],
                ['siswa'],
                nisn=student['nisn'],
                gender=student['gender'],
                phone='081234567890'
            )
            await db.users.insert_one(siswa_user)
            siswa_ids.append(siswa_user['id'])

            # Student profile
            siswa_profile = {
                'id': str(uuid.uuid4()),
                'user_id': siswa_user['id'],
                'nisn': student['nisn'],
                'nis': f"2025{str(len(siswa_ids)).zfill(4)}",
                'full_name': student['full_name'],
                'class_id': class_ids.get(student['class_name']),
                'class_name': student['class_name'],
                'gender': student['gender'],
                'birth_place': 'Malang',
                'birth_date': f"201{random.randint(0,2)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                'address': f"Jl. Contoh No. {random.randint(1,100)}, Malang",
                'phone': '081234567890',
                'parent_name': f"Orang Tua {student['full_name']}",
                'parent_phone': '081234567891',
                'is_active': True,
                'created_at': datetime.utcnow(),
            }
            await db.students.insert_one(siswa_profile)

    print(f"   -> {len(students_data)} students created")

    # ============================================================
    # 6. SUBJECTS (Mata Pelajaran)
    # ============================================================
    print("[6/15] Subjects...")

    subjects_data = [
        'Al-Quran Hadits', 'Akidah Akhlak', 'Fiqih', 'SKI',
        'Bahasa Arab', 'Bahasa Indonesia', 'Bahasa Inggris',
        'Matematika', 'IPA', 'IPS', 'PKn',
        'Seni Budaya', 'PJOK', 'Prakarya'
    ]

    subject_ids = {}
    for subject_name in subjects_data:
        exists = await db.subjects.find_one({'name': subject_name})
        if not exists:
            subject_id = str(uuid.uuid4())
            subject = {
                'id': subject_id,
                'name': subject_name,
                'code': subject_name[:3].upper(),
                'is_active': True,
                'created_at': datetime.utcnow(),
            }
            await db.subjects.insert_one(subject)
            subject_ids[subject_name] = subject_id
        else:
            subject_ids[subject_name] = exists['id']
    print(f"   -> {len(subjects_data)} subjects created")

    # ============================================================
    # 7. SCHEDULES (Jadwal Pelajaran)
    # ============================================================
    print("[7/15] Schedules (Jadwal Pelajaran)...")

    days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
    time_slots = [
        ('07:00', '07:40'), ('07:40', '08:20'), ('08:20', '09:00'), ('09:00', '09:40'),
        ('10:00', '10:40'), ('10:40', '11:20'), ('11:20', '12:00'), ('12:30', '13:10'),
    ]

    schedule_count = 0
    for class_name, class_id in class_ids.items():
        for day_idx, day in enumerate(days):
            slots_today = random.randint(5, 7)
            used_subjects = []

            for slot_idx in range(slots_today):
                if slot_idx >= len(time_slots):
                    break

                available_subjects = [s for s in subjects_data if s not in used_subjects]
                if not available_subjects:
                    available_subjects = subjects_data

                subject_name = random.choice(available_subjects)
                used_subjects.append(subject_name)

                room_name = f"R-{class_name}" if f"R-{class_name}" in room_ids else random.choice(list(room_ids.keys()))
                teacher_id = random.choice(guru_ids) if guru_ids else None

                exists = await db.schedules.find_one({
                    'class_id': class_id,
                    'day': day,
                    'start_time': time_slots[slot_idx][0]
                })

                if not exists:
                    schedule = {
                        'id': str(uuid.uuid4()),
                        'academic_year_id': ay_id,
                        'class_id': class_id,
                        'subject_id': subject_ids.get(subject_name),
                        'teacher_id': teacher_id,
                        'room_id': room_ids.get(room_name),
                        'day': day,
                        'start_time': time_slots[slot_idx][0],
                        'end_time': time_slots[slot_idx][1],
                        'session_number': slot_idx + 1,
                        'is_active': True,
                        'created_at': datetime.utcnow(),
                    }
                    await db.schedules.insert_one(schedule)
                    schedule_count += 1

    print(f"   -> {schedule_count} schedules created")

    # ============================================================
    # 8. HOLIDAYS
    # ============================================================
    print("[8/15] Holidays...")

    holidays = [
        {'name': 'Tahun Baru 2026', 'date': '2026-01-01', 'category': 'nasional'},
        {'name': 'Isra Miraj', 'date': '2026-02-14', 'category': 'keagamaan'},
        {'name': 'Hari Raya Nyepi', 'date': '2026-03-22', 'category': 'nasional'},
        {'name': 'Idul Fitri', 'date': '2026-03-31', 'category': 'keagamaan'},
        {'name': 'Cuti Bersama', 'date': '2026-04-01', 'category': 'nasional'},
        {'name': 'Wafat Isa Al-Masih', 'date': '2026-04-10', 'category': 'keagamaan'},
        {'name': 'Hari Buruh', 'date': '2026-05-01', 'category': 'nasional'},
        {'name': 'Kenaikan Isa Al-Masih', 'date': '2026-05-21', 'category': 'keagamaan'},
        {'name': 'Hari Raya Waisak', 'date': '2026-05-31', 'category': 'keagamaan'},
        {'name': 'Pancasila', 'date': '2026-06-01', 'category': 'nasional'},
        {'name': 'Idul Adha', 'date': '2026-06-07', 'category': 'keagamaan'},
        {'name': 'Tahun Baru Islam', 'date': '2026-06-27', 'category': 'keagamaan'},
        {'name': 'HUT RI', 'date': '2026-08-17', 'category': 'nasional'},
        {'name': 'Maulid Nabi', 'date': '2026-09-05', 'category': 'keagamaan'},
        {'name': 'Natal', 'date': '2026-12-25', 'category': 'keagamaan'},
    ]

    for holiday in holidays:
        exists = await db.holidays.find_one({'date': holiday['date']})
        if not exists:
            holiday_doc = {
                'id': str(uuid.uuid4()),
                'name': holiday['name'],
                'date': holiday['date'],
                'category': holiday['category'],
                'description': f"Hari libur {holiday['category']}",
                'is_academic_holiday': True,
                'created_at': datetime.utcnow(),
            }
            await db.holidays.insert_one(holiday_doc)
    print(f"   -> {len(holidays)} holidays created")

    # ============================================================
    # 9. RKAM BUDGET ITEMS
    # ============================================================
    print("[9/15] RKAM Budget Items...")

    rkam_items = [
        {'code': '1.1.1', 'name': 'Pengadaan Buku Pelajaran Kelas 7', 'category': 'Operasional', 'bidang': 'kurikulum', 'sumber_dana': 'BOS', 'allocated': 35000000, 'realized': 28500000},
        {'code': '1.1.2', 'name': 'Pengadaan Buku Pelajaran Kelas 8', 'category': 'Operasional', 'bidang': 'kurikulum', 'sumber_dana': 'BOS', 'allocated': 32000000, 'realized': 32000000},
        {'code': '1.2.1', 'name': 'Pemeliharaan Komputer Lab', 'category': 'Operasional', 'bidang': 'sarana_prasarana', 'sumber_dana': 'BOS', 'allocated': 15000000, 'realized': 8500000},
        {'code': '1.3.1', 'name': 'Kegiatan Literasi dan Numerasi', 'category': 'Program', 'bidang': 'kurikulum', 'sumber_dana': 'BOS', 'allocated': 20000000, 'realized': 15000000},
        {'code': '1.4.1', 'name': 'Pelatihan Guru Kurikulum Merdeka', 'category': 'Pendidikan', 'bidang': 'kurikulum', 'sumber_dana': 'BOS', 'allocated': 22000000, 'realized': 18000000},
        {'code': '2.1.1', 'name': 'Renovasi Ruang Kelas', 'category': 'Pembangunan', 'bidang': 'sarana_prasarana', 'sumber_dana': 'KOMITE', 'allocated': 45000000, 'realized': 30000000},
        {'code': '2.2.1', 'name': 'Pengadaan AC Ruang Guru', 'category': 'Pembangunan', 'bidang': 'sarana_prasarana', 'sumber_dana': 'KOMITE', 'allocated': 25000000, 'realized': 25000000},
        {'code': '2.3.1', 'name': 'Kegiatan Ekstrakulikuler', 'category': 'Program', 'bidang': 'kesiswaan', 'sumber_dana': 'KOMITE', 'allocated': 18000000, 'realized': 12000000},
    ]

    for item in rkam_items:
        exists = await db.rkam_budget_items.find_one({'code': item['code'], 'fiscal_year': fiscal_year})
        if not exists:
            budget_item = {
                'id': str(uuid.uuid4()),
                'code': item['code'],
                'name': item['name'],
                'category': item['category'],
                'bidang': item['bidang'],
                'sumber_dana': item['sumber_dana'],
                'description': f"Detail {item['name']}",
                'allocated_amount': float(item['allocated']),
                'realized_amount': float(item['realized']),
                'remaining_amount': float(item['allocated'] - item['realized']),
                'fiscal_year': fiscal_year,
                'quarter': 'Q1',
                'is_active': True,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
            }
            await db.rkam_budget_items.insert_one(budget_item)
    print(f"   -> {len(rkam_items)} RKAM items created")

    # RKAM Documents
    rkam_docs = [
        {'title': 'Laporan Realisasi Q1', 'type': 'Laporan', 'quarter': 'Q1'},
        {'title': 'RKAM 2025/2026', 'type': 'Proposal', 'quarter': None},
        {'title': 'Bukti Realisasi BOS', 'type': 'Bukti', 'quarter': 'Q2'},
    ]

    for doc in rkam_docs:
        exists = await db.rkam_documents.find_one({'title': doc['title'], 'fiscal_year': fiscal_year})
        if not exists:
            doc_item = {
                'id': str(uuid.uuid4()),
                'title': doc['title'],
                'description': f"Dokumen {doc['title']}",
                'document_type': doc['type'],
                'file_url': f"https://example.com/docs/{doc['title'].lower().replace(' ', '-')}.pdf",
                'file_name': f"{doc['title']}.pdf",
                'fiscal_year': fiscal_year,
                'quarter': doc['quarter'],
                'is_public': True,
                'upload_date': datetime.utcnow(),
                'created_at': datetime.utcnow(),
            }
            await db.rkam_documents.insert_one(doc_item)
    print(f"   -> {len(rkam_docs)} RKAM documents created")

    # ============================================================
    # 10. ACHIEVEMENTS (Prestasi)
    # ============================================================
    print("[10/15] Achievements...")

    achievements = [
        {'name': 'Juara 1 Olimpiade Matematika Kota', 'category': 'Akademik', 'level': 'Kabupaten/Kota', 'holder_type': 'siswa', 'holder_name': 'Ahmad Rizki Pratama', 'year': 2025},
        {'name': 'Juara 2 Lomba KTI Provinsi', 'category': 'Akademik', 'level': 'Provinsi', 'holder_type': 'siswa', 'holder_name': 'Siti Nurhaliza', 'year': 2025},
        {'name': 'Juara 1 Pramuka Nasional', 'category': 'Non-Akademik', 'level': 'Nasional', 'holder_type': 'siswa', 'holder_name': 'Regu Pramuka MTsN 2', 'year': 2025},
        {'name': 'Guru Berprestasi Kota', 'category': 'Guru', 'level': 'Kabupaten/Kota', 'holder_type': 'guru', 'holder_name': 'Dra. Siti Aminah, M.Pd', 'year': 2025},
        {'name': 'Madrasah Adiwiyata Provinsi', 'category': 'Madrasah', 'level': 'Provinsi', 'holder_type': 'madrasah', 'holder_name': 'MTsN 2 Kota Malang', 'year': 2025},
    ]

    for ach in achievements:
        exists = await db.achievements.find_one({'name': ach['name'], 'year': ach['year']})
        if not exists:
            achievement = {
                'id': str(uuid.uuid4()),
                'name': ach['name'],
                'category': ach['category'],
                'level': ach['level'],
                'achievement_date': '2025-09-15',
                'year': ach['year'],
                'holder_type': ach['holder_type'],
                'holder_name': ach['holder_name'],
                'holder_class': '8A' if ach['holder_type'] == 'siswa' else None,
                'organizer': f"Dinas Pendidikan {ach['level']}",
                'description': f"Prestasi {ach['name']}",
                'certificate_url': 'https://example.com/certificate.pdf',
                'is_public': True,
                'created_at': datetime.utcnow(),
            }
            await db.achievements.insert_one(achievement)
    print(f"   -> {len(achievements)} achievements created")

    # ============================================================
    # 11. ANNOUNCEMENTS (Pengumuman)
    # ============================================================
    print("[11/15] Announcements...")

    announcements = [
        {'title': 'Libur Semester Ganjil', 'category': 'umum', 'priority': 'high', 'target_roles': ['siswa', 'guru', 'wali_kelas'], 'is_public': True},
        {'title': 'Pendaftaran Ekstrakurikuler', 'category': 'kesiswaan', 'priority': 'normal', 'target_roles': ['siswa'], 'is_public': True},
        {'title': 'Rapat Koordinasi Guru', 'category': 'akademik', 'priority': 'urgent', 'target_roles': ['guru', 'wali_kelas'], 'is_public': False},
        {'title': 'Pelaksanaan Ujian Tengah Semester', 'category': 'akademik', 'priority': 'high', 'target_roles': ['siswa', 'guru'], 'is_public': True},
        {'title': 'Pelatihan E-Learning untuk Guru', 'category': 'akademik', 'priority': 'normal', 'target_roles': ['guru'], 'is_public': False},
    ]

    for ann in announcements:
        exists = await db.announcements.find_one({'title': ann['title']})
        if not exists:
            announcement = {
                'id': str(uuid.uuid4()),
                'title': ann['title'],
                'content': f"Konten pengumuman tentang {ann['title']}. Mohon perhatian semua pihak terkait.",
                'category': ann['category'],
                'priority': ann['priority'],
                'target_roles': ann['target_roles'],
                'is_public': ann['is_public'],
                'published_at': datetime.utcnow(),
                'expires_at': datetime.utcnow() + timedelta(days=30),
                'created_by': 'admin',
                'created_at': datetime.utcnow(),
            }
            await db.announcements.insert_one(announcement)
    print(f"   -> {len(announcements)} announcements created")

    # ============================================================
    # 12. TATIB (Tata Tertib) - Categories & Data
    # ============================================================
    print("[12/15] Tata Tertib...")

    tatib_categories = [
        {'name': 'Pelanggaran Ringan', 'point': 10, 'color': '#FFA500'},
        {'name': 'Pelanggaran Sedang', 'point': 25, 'color': '#FF6B6B'},
        {'name': 'Pelanggaran Berat', 'point': 50, 'color': '#DC143C'},
    ]

    tatib_cat_ids = {}
    for cat in tatib_categories:
        exists = await db.tatib_categories.find_one({'name': cat['name']})
        if not exists:
            cat_id = str(uuid.uuid4())
            category = {
                'id': cat_id,
                'name': cat['name'],
                'default_point': cat['point'],
                'color': cat['color'],
                'is_active': True,
                'created_at': datetime.utcnow(),
            }
            await db.tatib_categories.insert_one(category)
            tatib_cat_ids[cat['name']] = cat_id
        else:
            tatib_cat_ids[cat['name']] = exists['id']
    print(f"   -> {len(tatib_categories)} tatib categories created")

    # Tatib violations examples (5 pelanggaran sample)
    if siswa_ids:
        for i in range(5):
            cat_name = random.choice(list(tatib_cat_ids.keys()))
            violation = {
                'id': str(uuid.uuid4()),
                'student_id': random.choice(siswa_ids),
                'category_id': tatib_cat_ids[cat_name],
                'violation_type': f"Terlambat masuk kelas" if i % 2 == 0 else "Tidak mengerjakan PR",
                'description': f"Deskripsi pelanggaran {i+1}",
                'point': tatib_categories[[c['name'] for c in tatib_categories].index(cat_name)]['point'],
                'violation_date': datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                'reported_by': random.choice(guru_ids) if guru_ids else None,
                'is_resolved': random.choice([True, False]),
                'created_at': datetime.utcnow(),
            }
            await db.tatib_violations.insert_one(violation)
    print("   -> 5 sample tatib violations created")

    # ============================================================
    # 13. MUTATIONS (Mutasi Siswa)
    # ============================================================
    print("[13/15] Mutations (Mutasi)...")

    # Mutasi Masuk
    mutation_in = {
        'id': str(uuid.uuid4()),
        'student_id': siswa_ids[0] if siswa_ids else None,
        'mutation_type': 'masuk',
        'from_school': 'SMP Negeri 5 Malang',
        'to_school': 'MTsN 2 Kota Malang',
        'mutation_date': '2025-08-01',
        'reason': 'Pindah mengikuti orang tua',
        'document_url': 'https://example.com/mutation_in.pdf',
        'status': 'approved',
        'created_at': datetime.utcnow(),
    }
    exists = await db.mutations.find_one({'student_id': mutation_in['student_id'], 'mutation_type': 'masuk'})
    if not exists and siswa_ids:
        await db.mutations.insert_one(mutation_in)

    # Mutasi Keluar
    mutation_out = {
        'id': str(uuid.uuid4()),
        'student_id': siswa_ids[1] if len(siswa_ids) > 1 else None,
        'mutation_type': 'keluar',
        'from_school': 'MTsN 2 Kota Malang',
        'to_school': 'MTsN 1 Kota Malang',
        'mutation_date': '2025-09-15',
        'reason': 'Pindah rumah',
        'document_url': 'https://example.com/mutation_out.pdf',
        'status': 'approved',
        'created_at': datetime.utcnow(),
    }
    exists = await db.mutations.find_one({'student_id': mutation_out['student_id'], 'mutation_type': 'keluar'})
    if not exists and len(siswa_ids) > 1:
        await db.mutations.insert_one(mutation_out)

    print("   -> 2 mutations created (1 masuk, 1 keluar)")

    # ============================================================
    # 14. ATTENDANCE (Kehadiran Sample)
    # ============================================================
    print("[14/15] Attendance (Sample kehadiran)...")

    # Create sample attendance for today
    today = datetime.now(WIB_TZ).date()
    attendance_count = 0

    # Get some schedules for today
    day_name = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][today.weekday()]
    schedules_today = await db.schedules.find({'day': day_name, 'is_active': True}).limit(10).to_list(length=10)

    for schedule in schedules_today:
        if not schedule.get('class_id'):
            continue

        # Get students in this class
        students_in_class = await db.students.find({'class_id': schedule['class_id']}).to_list(length=100)

        for student in students_in_class[:5]:  # Sample 5 students per schedule
            status_choices = ['hadir', 'hadir', 'hadir', 'sakit', 'izin']  # 60% hadir
            attendance = {
                'id': str(uuid.uuid4()),
                'schedule_id': schedule['id'],
                'student_id': student.get('user_id'),
                'class_id': schedule['class_id'],
                'date': today.isoformat(),
                'status': random.choice(status_choices),
                'notes': 'Auto-generated sample data',
                'created_at': datetime.utcnow(),
            }

            exists = await db.attendances.find_one({
                'schedule_id': schedule['id'],
                'student_id': student.get('user_id'),
                'date': today.isoformat()
            })

            if not exists:
                await db.attendances.insert_one(attendance)
                attendance_count += 1

    print(f"   -> {attendance_count} sample attendance records created")

    # ============================================================
    # 15. JOURNALS (Jurnal Mengajar Sample)
    # ============================================================
    print("[15/15] Journals (Sample jurnal mengajar)...")

    journal_count = 0
    for schedule in schedules_today[:5]:  # Sample 5 journals
        journal = {
            'id': str(uuid.uuid4()),
            'schedule_id': schedule['id'],
            'teacher_id': schedule.get('teacher_id'),
            'class_id': schedule['class_id'],
            'subject_id': schedule.get('subject_id'),
            'date': today.isoformat(),
            'start_time': schedule.get('start_time'),
            'end_time': schedule.get('end_time'),
            'material': f"Materi pembelajaran sesi {schedule.get('session_number', 1)}",
            'method': 'Ceramah, Diskusi, dan Praktik',
            'notes': 'Siswa aktif dan antusias',
            'status': 'filled',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        }

        exists = await db.journals.find_one({
            'schedule_id': schedule['id'],
            'date': today.isoformat()
        })

        if not exists:
            await db.journals.insert_one(journal)
            journal_count += 1

    print(f"   -> {journal_count} sample journals created")

    print("\n" + "="*60)
    print("SUCCESS! ALL DATA SEEDING COMPLETED")
    print("="*60)
    print("\nData Summary:")
    print(f"  - Settings: 1")
    print(f"  - Academic Years: 1, Semesters: 2")
    print(f"  - Users: Admin(1) + Guru(5) + Tendik(2)")
    print(f"  - Students: 30")
    print(f"  - Classes: 9, Rooms: 12")
    print(f"  - Subjects: {len(subjects_data)}")
    print(f"  - Schedules: {schedule_count}")
    print(f"  - Holidays: {len(holidays)}")
    print(f"  - RKAM Items: {len(rkam_items)}, Documents: {len(rkam_docs)}")
    print(f"  - Achievements: {len(achievements)}")
    print(f"  - Announcements: {len(announcements)}")
    print(f"  - Tatib Categories: {len(tatib_categories)}, Violations: 5")
    print(f"  - Mutations: 2 (1 in, 1 out)")
    print(f"  - Attendance: {attendance_count} (sample for today)")
    print(f"  - Journals: {journal_count} (sample for today)")
    print("\nYou can now test all features!")
    print("="*60 + "\n")


async def main():
    # MongoDB Atlas connection
    MONGO_URL = "mongodb+srv://kamaludinzuhri_db_user:Mtsn2kotamalang*@cluster0.qougudd.mongodb.net/"
    DB_NAME = "super_app_madrasah"

    print(f"\nConnecting to MongoDB Atlas...")
    print(f"Database: {DB_NAME}\n")

    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]

        # Test connection
        await client.admin.command('ping')
        print("SUCCESS! MongoDB Atlas connection established!\n")

        await seed_all_data(db)
    except Exception as e:
        print(f"\nERROR: {e}")
        print("Make sure MongoDB Atlas is accessible!\n")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(main())
