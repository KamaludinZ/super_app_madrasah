"""
Seed initial data for Super Apps MATSANDATAMA.
Creates demo accounts, academic year, classes, rooms, subjects, schedules.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pyotp
from auth_utils import hash_password
from journal_core import now_wib, current_day_id

WIB_TZ = timezone(timedelta(hours=7))


def is_production_env() -> bool:
    return os.environ.get("ENV", "development").strip().lower() == "production"


def make_user(username, password, full_name, roles, **kw):
    return {
        'id': str(uuid.uuid4()),
        'username': username,
        'password_hash': hash_password(password),
        'full_name': full_name,
        'roles': roles,
        'is_active': True,
        'created_at': datetime.utcnow().isoformat(),
        **kw,
    }


async def seed_production_minimal(db: Any):
    """Production seeding: only ensure admin account exists."""
    admin_exists = await db.users.count_documents({'username': 'admin'})
    if admin_exists > 0:
        print("[seed] Production mode: admin already exists, skipping admin seed.")
        return

    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin = make_user(
        'admin',
        admin_password,
        'Administrator MATSANDATAMA',
        ['admin'],
        email='admin@matsandatama.sch.id'
    )
    await db.users.insert_one(admin)
    print("[seed] Production mode: admin account created.")
    print("[seed] Data lainnya ditambahkan manual di production.")


async def seed_all(db: Any):
    if is_production_env():
        await seed_production_minimal(db)
        return

    # Skip if users already exist
    user_count = await db.users.count_documents({})
    if user_count > 0:
        print(f"[seed] {user_count} users already exist, skipping seed.")
        return

    print("[seed] Creating initial data...")

    # ============================================================
    # 1. SETTINGS
    # ============================================================
    settings = {
        'id': 'global_config',
        'app_name': 'Super Apps MATSANDATAMA',
        'school_name': 'MTsN 2 Kota Malang',
        'npsn': '20533771',
        'accreditation': 'A',
        'headmaster_name': 'H. Mohammad Husnan, M.Pd',
        'address': 'Jl. Cemorokandang No.77, Kedungkandang, Kota Malang, Jawa Timur',
        'phone': '(0341) 712073',
        'email': 'info@mtsn2kotamalang.sch.id',
        # Default Kemenag logo (placeholder - simple SVG-based)
        'logo_url': None,
        'primary_color': '#006837',
        'gps_default_enabled': True,
        'gps_default_radius': 30.0,
        'qr_default_mode': 'static',
        'grace_minutes': 15,
        'updated_at': datetime.utcnow().isoformat(),
        'updated_by': 'system',
    }
    await db.settings.insert_one(settings)
    print("[seed] Settings created")

    # ============================================================
    # 2. ACADEMIC YEAR (2025/2026 Ganjil)
    # ============================================================
    ay_id = str(uuid.uuid4())
    academic_year = {
        'id': ay_id,
        'name': '2025/2026',
        'is_active': True,
        'semester_type': 'regular',
        'semesters': [
            {'name': 'ganjil', 'label': 'Ganjil', 'is_active': True, 'start_date': '2025-07-15', 'end_date': '2025-12-20'},
            {'name': 'genap', 'label': 'Genap', 'is_active': False, 'start_date': '2026-01-05', 'end_date': '2026-06-15'},
        ],
        'active_semester': 'ganjil',
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.academic_years.insert_one(academic_year)
    print("[seed] Academic year 2025/2026 created")

    # ============================================================
    # 3. SUBJECTS (Mata Pelajaran)
    # ============================================================
    subjects_data = [
        ('MTK', 'Matematika'),
        ('IPA', 'IPA Terpadu'),
        ('IPS', 'IPS Terpadu'),
        ('BIN', 'Bahasa Indonesia'),
        ('BIG', 'Bahasa Inggris'),
        ('BAR', 'Bahasa Arab'),
        ('AAQ', 'Al-Quran Hadits'),
        ('FIQ', 'Fiqih'),
        ('AKD', 'Akidah Akhlak'),
        ('SKI', 'Sejarah Kebudayaan Islam'),
        ('PKN', 'PPKn'),
        ('SBD', 'Seni Budaya'),
        ('PJK', 'PJOK'),
        ('TIK', 'Informatika'),
    ]
    subject_map = {}
    for code, name in subjects_data:
        sid = str(uuid.uuid4())
        await db.subjects.insert_one({
            'id': sid, 'code': code, 'name': name,
            'created_at': datetime.utcnow().isoformat(),
        })
        subject_map[code] = sid
    print(f"[seed] {len(subjects_data)} subjects created")

    # ============================================================
    # 4. ROOMS (Ruangan) - with GPS coordinates around MTsN 2 Malang
    # ============================================================
    # Base coordinates for MTsN 2 Kota Malang (approximate)
    base_lat = -7.9839
    base_lon = 112.6549
    rooms_data = [
        ('R-7A', 'Ruang Kelas 7A', base_lat + 0.00001, base_lon + 0.00001),
        ('R-7B', 'Ruang Kelas 7B', base_lat + 0.00002, base_lon + 0.00001),
        ('R-7C', 'Ruang Kelas 7C', base_lat + 0.00003, base_lon + 0.00001),
        ('R-8A', 'Ruang Kelas 8A', base_lat + 0.00001, base_lon + 0.00002),
        ('R-8B', 'Ruang Kelas 8B', base_lat + 0.00002, base_lon + 0.00002),
        ('R-9A', 'Ruang Kelas 9A', base_lat + 0.00001, base_lon + 0.00003),
        ('R-9B', 'Ruang Kelas 9B', base_lat + 0.00002, base_lon + 0.00003),
        ('LAB-IPA', 'Laboratorium IPA', base_lat + 0.00004, base_lon + 0.00004),
    ]
    room_map = {}
    for code, name, lat, lon in rooms_data:
        rid = str(uuid.uuid4())
        await db.rooms.insert_one({
            'id': rid, 'name': code, 'description': name,
            'gps_lat': lat, 'gps_lon': lon, 'gps_radius_meters': 30.0,
            'gps_enabled': False,  # OFF by default for easier testing
            'qr_mode': 'static', 'qr_secret': pyotp.random_base32(),
            'created_at': datetime.utcnow().isoformat(),
        })
        room_map[code] = rid
    print(f"[seed] {len(rooms_data)} rooms created (GPS disabled by default for testing)")

    # ============================================================
    # 5. CLASSES (Kelas) - linked to rooms and homeroom teachers later
    # ============================================================
    classes_data = [
        ('7A', 7, 'A', 'R-7A'),
        ('7B', 7, 'B', 'R-7B'),
        ('7C', 7, 'C', 'R-7C'),
        ('8A', 8, 'A', 'R-8A'),
        ('8B', 8, 'B', 'R-8B'),
        ('9A', 9, 'A', 'R-9A'),
        ('9B', 9, 'B', 'R-9B'),
    ]
    class_map = {}
    for name, grade, parallel, room_code in classes_data:
        cid = str(uuid.uuid4())
        await db.classes.insert_one({
            'id': cid, 'name': name, 'grade': grade, 'parallel': parallel,
            'academic_year_id': ay_id, 'room_id': room_map.get(room_code),
            'homeroom_teacher_id': None,  # set later
            'created_at': datetime.utcnow().isoformat(),
        })
        class_map[name] = cid
    print(f"[seed] {len(classes_data)} classes created")

    # ============================================================
    # 6. DEMO USERS (10 accounts covering all roles)
    # ============================================================
    # 1. Admin
    admin = make_user('admin', 'admin123', 'Administrator MATSANDATAMA', ['admin'],
                       email='admin@matsandatama.sch.id')

    # 2. Guru Mapel (Matematika)
    guru1 = make_user('guru1', 'guru123', 'Drs. Ahmad Fauzi, M.Pd', ['guru'],
                       nip_nuptk='197503152005011001')

    # 3. Wali Kelas 7A + Guru IPA (multi-role)
    walas7a = make_user('walas7a', 'walas123', 'Hj. Siti Aminah, S.Pd', ['wali_kelas', 'guru'],
                         nip_nuptk='198006102008012004')

    # 4. Siswa kelas 7A
    siswa1 = make_user('siswa1', 'siswa123', 'Muhammad Rizki Pratama', ['siswa'],
                        nisn='0098765432', student_class_id=class_map['7A'])

    siswa2 = make_user('siswa2', 'siswa123', 'Aisyah Nur Hidayah', ['siswa'],
                        nisn='0098765433', student_class_id=class_map['7A'])

    # 5. Orang tua - REMOVED per requirement (akun siswa dipakai gabungan)
    # (Skip ortu1)

    # 6. Guru Ekstrakurikuler (Pramuka)
    ek1 = make_user('ek1', 'ek123', 'Kak Bambang Setiawan', ['guru_ekstrakurikuler'])

    # 7. Tenaga Kependidikan
    tendik1 = make_user('tendik1', 'tendik123', 'Ibu Sri Wahyuni (Staf TU)', ['tenaga_kependidikan'])

    # 8. Guru Piket
    piket1 = make_user('piket1', 'piket123', 'Bapak Hadi Susanto, S.Pd', ['guru_piket', 'guru'])

    # 9. Guru BK
    bk1 = make_user('bk1', 'bk123', 'Ibu Dr. Indah Permatasari, M.Psi', ['guru_bk'])

    # 10. Guru Tata Tertib
    tatib1 = make_user('tatib1', 'tatib123', 'Bapak Sugeng Riyadi, S.Ag', ['guru_tata_tertib', 'guru'])

    all_users = [admin, guru1, walas7a, siswa1, siswa2, ek1, tendik1, piket1, bk1, tatib1]
    await db.users.insert_many(all_users)
    print(f"[seed] {len(all_users)} demo users created")

    # Assign Wali Kelas 7A
    await db.classes.update_one({'id': class_map['7A']}, {'$set': {'homeroom_teacher_id': walas7a['id']}})

    # ============================================================
    # 7. SCHEDULES (Today's schedule for testing)
    # ============================================================
    # Get current time and create a schedule that's ACTIVE NOW + others
    now = now_wib()
    today_day = current_day_id()

    # Helper to format HH:MM
    def fmt_time(dt):
        return dt.strftime('%H:%M')

    # Active schedule (now): guru1 teaches Matematika in 7A
    active_start = now - timedelta(minutes=10)
    active_end = now + timedelta(minutes=35)

    # Past schedule (this morning)
    past_start = now.replace(hour=7, minute=0)
    past_end = now.replace(hour=7, minute=45)
    if past_end >= now:
        past_start = now - timedelta(hours=3)
        past_end = past_start + timedelta(minutes=45)

    # Upcoming schedule (later today)
    upcoming_start = now + timedelta(hours=1)
    upcoming_end = upcoming_start + timedelta(minutes=45)

    schedules_data = [
        # Active now: guru1 Matematika @ 7A
        {
            'academic_year_id': ay_id, 'semester': 'ganjil',
            'class_id': class_map['7A'], 'subject_id': subject_map['MTK'],
            'teacher_id': guru1['id'], 'room_id': room_map['R-7A'],
            'day': today_day, 'start_time': fmt_time(active_start), 'end_time': fmt_time(active_end),
        },
        # Walas7a (also guru IPA) @ 7B (later today, upcoming)
        {
            'academic_year_id': ay_id, 'semester': 'ganjil',
            'class_id': class_map['7B'], 'subject_id': subject_map['IPA'],
            'teacher_id': walas7a['id'], 'room_id': room_map['R-7B'],
            'day': today_day, 'start_time': fmt_time(upcoming_start), 'end_time': fmt_time(upcoming_end),
        },
        # Past schedule for walas7a (already done, will show as missing)
        {
            'academic_year_id': ay_id, 'semester': 'ganjil',
            'class_id': class_map['7A'], 'subject_id': subject_map['IPA'],
            'teacher_id': walas7a['id'], 'room_id': room_map['R-7A'],
            'day': today_day, 'start_time': fmt_time(past_start), 'end_time': fmt_time(past_end),
        },
        # Tatib1 (Akidah Akhlak) @ 8A active later
        {
            'academic_year_id': ay_id, 'semester': 'ganjil',
            'class_id': class_map['8A'], 'subject_id': subject_map['AKD'],
            'teacher_id': tatib1['id'], 'room_id': room_map['R-8A'],
            'day': today_day, 'start_time': fmt_time(upcoming_start + timedelta(hours=2)),
            'end_time': fmt_time(upcoming_end + timedelta(hours=2)),
        },
        # Piket1 (Bahasa Indonesia) @ 9A
        {
            'academic_year_id': ay_id, 'semester': 'ganjil',
            'class_id': class_map['9A'], 'subject_id': subject_map['BIN'],
            'teacher_id': piket1['id'], 'room_id': room_map['R-9A'],
            'day': today_day, 'start_time': fmt_time(now + timedelta(hours=3)),
            'end_time': fmt_time(now + timedelta(hours=3, minutes=45)),
        },
    ]

    # Add schedules for other days of week
    days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']
    for day in days:
        if day == today_day:
            continue
        # 1 schedule per other day for variety
        schedules_data.append({
            'academic_year_id': ay_id, 'semester': 'ganjil',
            'class_id': class_map['7A'], 'subject_id': subject_map['MTK'],
            'teacher_id': guru1['id'], 'room_id': room_map['R-7A'],
            'day': day, 'start_time': '08:00', 'end_time': '08:45',
        })

    for s in schedules_data:
        s['id'] = str(uuid.uuid4())
        s['is_published'] = True
        s['created_at'] = datetime.utcnow().isoformat()
    await db.schedules.insert_many(schedules_data)
    print(f"[seed] {len(schedules_data)} schedules created")

    # ============================================================
    # 8. ONE SAMPLE JURNAL (so public monitoring shows variety)
    # ============================================================
    sample_journal = {
        'id': str(uuid.uuid4()),
        'schedule_id': schedules_data[2]['id'],  # past schedule walas7a
        'teacher_id': walas7a['id'],
        'class_id': class_map['7A'],
        'subject_id': subject_map['IPA'],
        'room_id': room_map['R-7A'],
        'academic_year_id': ay_id, 'semester': 'ganjil',
        'materi': 'Klasifikasi Makhluk Hidup (Bab 2)',
        'catatan': 'Siswa antusias mengikuti pelajaran. Tugas: rangkuman.',
        'siswa_hadir': 28, 'siswa_tidak_hadir': 1, 'siswa_izin': 1, 'siswa_sakit': 0,
        'started_at': (now - timedelta(hours=2)).isoformat(),
        'scheduled_start': past_start.isoformat(),
        'scheduled_end': past_end.isoformat(),
        'validations': {'overall_valid': True, 'qr': {'valid': True}, 'schedule': {'valid': True}, 'gps': {'valid': True}},
        'qr_mode': 'static', 'is_locked': True,
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.journals.insert_one(sample_journal)
    print("[seed] Sample journal created (for monitoring page demo)")

    # ============================================================
    # 9. SAMPLE INDIKATOR & MATERI (for jurnal mengajar dropdown)
    # ============================================================
    # Check if indikator data already exists
    indikator_count = await db.indikator.count_documents({})
    if indikator_count > 0:
        print(f"[seed] {indikator_count} indikator already exist, skipping indikator/materi seed.")
    else:
        # Get current semester
        current_semester = await db.semesters.find_one({'is_active': True})
        semester_id = current_semester['id'] if current_semester else str(uuid.uuid4())

        # Sample Indikator for Matematika Kelas 7
        indikator_mtk_data = [
            {
                'id': str(uuid.uuid4()),
                'kode': '3.1',
                'nama': 'Menjelaskan dan melakukan operasi hitung bilangan bulat dan pecahan',
                'mapel_id': subject_map['MTK'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'created_by': guru1['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            {
                'id': str(uuid.uuid4()),
                'kode': '3.2',
                'nama': 'Menjelaskan himpunan, himpunan bagian, komplemen himpunan, operasi himpunan',
                'mapel_id': subject_map['MTK'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'created_by': guru1['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            {
                'id': str(uuid.uuid4()),
                'kode': '3.3',
                'nama': 'Menjelaskan dan menentukan urutan pada bilangan bulat dan pecahan',
                'mapel_id': subject_map['MTK'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'created_by': guru1['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
        ]

        # Sample Indikator for IPA Kelas 7
        indikator_ipa_data = [
            {
                'id': str(uuid.uuid4()),
                'kode': '3.1',
                'nama': 'Menerapkan konsep pengukuran berbagai besaran yang ada pada diri, makhluk hidup, dan lingkungan fisik',
                'mapel_id': subject_map['IPA'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'created_by': walas7a['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            {
                'id': str(uuid.uuid4()),
                'kode': '3.2',
                'nama': 'Mengklasifikasikan makhluk hidup dan benda berdasarkan karakteristik yang diamati',
                'mapel_id': subject_map['IPA'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'created_by': walas7a['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
        ]

        all_indikator = indikator_mtk_data + indikator_ipa_data
        await db.indikator.insert_many(all_indikator)
        print(f"[seed] {len(all_indikator)} sample indikator created")

        # Sample Materi for each Indikator
        materi_data = [
            # Materi untuk MTK Indikator 3.1
            {
                'id': str(uuid.uuid4()),
                'nama': 'Operasi Penjumlahan dan Pengurangan Bilangan Bulat',
                'indikator_id': indikator_mtk_data[0]['id'],
                'mapel_id': subject_map['MTK'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'deskripsi': 'Memahami konsep penjumlahan dan pengurangan pada bilangan bulat positif dan negatif',
                'created_by': guru1['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            {
                'id': str(uuid.uuid4()),
                'nama': 'Operasi Perkalian dan Pembagian Bilangan Bulat',
                'indikator_id': indikator_mtk_data[0]['id'],
                'mapel_id': subject_map['MTK'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'deskripsi': 'Memahami konsep perkalian dan pembagian pada bilangan bulat',
                'created_by': guru1['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            # Materi untuk MTK Indikator 3.2
            {
                'id': str(uuid.uuid4()),
                'nama': 'Pengertian Himpunan dan Anggota Himpunan',
                'indikator_id': indikator_mtk_data[1]['id'],
                'mapel_id': subject_map['MTK'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'deskripsi': 'Memahami definisi himpunan, notasi himpunan, dan cara menyatakan anggota himpunan',
                'created_by': guru1['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            {
                'id': str(uuid.uuid4()),
                'nama': 'Operasi Himpunan (Gabungan, Irisan, Selisih)',
                'indikator_id': indikator_mtk_data[1]['id'],
                'mapel_id': subject_map['MTK'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'deskripsi': 'Memahami operasi pada himpunan seperti gabungan, irisan, dan selisih',
                'created_by': guru1['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            # Materi untuk IPA Indikator 3.1
            {
                'id': str(uuid.uuid4()),
                'nama': 'Besaran Pokok dan Besaran Turunan',
                'indikator_id': indikator_ipa_data[0]['id'],
                'mapel_id': subject_map['IPA'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'deskripsi': 'Memahami perbedaan besaran pokok dan besaran turunan serta satuannya',
                'created_by': walas7a['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            {
                'id': str(uuid.uuid4()),
                'nama': 'Pengukuran dengan Alat Ukur',
                'indikator_id': indikator_ipa_data[0]['id'],
                'mapel_id': subject_map['IPA'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'deskripsi': 'Menggunakan berbagai alat ukur seperti penggaris, jangka sorong, dan timbangan',
                'created_by': walas7a['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            # Materi untuk IPA Indikator 3.2
            {
                'id': str(uuid.uuid4()),
                'nama': 'Klasifikasi Makhluk Hidup Berdasarkan Ciri-Ciri',
                'indikator_id': indikator_ipa_data[1]['id'],
                'mapel_id': subject_map['IPA'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'deskripsi': 'Mengelompokkan makhluk hidup berdasarkan persamaan dan perbedaan ciri yang dimiliki',
                'created_by': walas7a['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
            {
                'id': str(uuid.uuid4()),
                'nama': 'Sistem Klasifikasi 5 Kingdom',
                'indikator_id': indikator_ipa_data[1]['id'],
                'mapel_id': subject_map['IPA'],
                'tingkat_kelas': 'VII',
                'semester_id': semester_id,
                'deskripsi': 'Memahami sistem klasifikasi makhluk hidup menjadi 5 kingdom',
                'created_by': walas7a['id'],
                'created_at': datetime.utcnow().isoformat(),
            },
        ]

        await db.materi.insert_many(materi_data)
        print(f"[seed] {len(materi_data)} sample materi created")

    print("[seed] ✅ ALL SEED DATA INSERTED SUCCESSFULLY")
    print("[seed] Demo accounts:")
    print("       admin/admin123, guru1/guru123, walas7a/walas123, siswa1/siswa123,")
    print("       siswa2/siswa123, ek1/ek123, tendik1/tendik123, piket1/piket123,")
    print("       bk1/bk123, tatib1/tatib123")


async def refresh_demo_schedule(db: Any):
    """
    Ensures there's always an ACTIVE NOW schedule for guru1 in R-7A for demo/testing.
    Also ensures settings has default active_days and teaching_slots.
    """
    if is_production_env():
        print("[refresh] Production mode: skip refresh_demo_schedule.")
        return

    try:
        # Backfill settings defaults if missing
        from models import DEFAULT_ACTIVE_DAYS, DEFAULT_TEACHING_SLOTS
        settings = await db.settings.find_one({'id': 'global_config'})
        if settings:
            updates = {}
            if not settings.get('active_days'):
                updates['active_days'] = list(DEFAULT_ACTIVE_DAYS)
            if not settings.get('teaching_slots'):
                updates['teaching_slots'] = list(DEFAULT_TEACHING_SLOTS)
            if 'idle_timeout_minutes' not in settings:
                updates['idle_timeout_minutes'] = 30
            if 'session_max_hours' not in settings:
                updates['session_max_hours'] = 12
            if updates:
                await db.settings.update_one({'id': 'global_config'}, {'$set': updates})
                print(f"[refresh] Backfilled settings: {list(updates.keys())}")

        ay = await db.academic_years.find_one({'is_active': True})
        if not ay:
            # Activate the seed AY if found
            seed_ay = await db.academic_years.find_one({'name': '2025/2026'})
            if seed_ay:
                await db.academic_years.update_many({}, {'$set': {'is_active': False}})
                await db.academic_years.update_one({'id': seed_ay['id']}, {'$set': {'is_active': True}})
                ay = seed_ay
                print("[refresh] Reactivated 2025/2026 academic year")

        if not ay:
            return

        guru1 = await db.users.find_one({'username': 'guru1'})
        room7a = await db.rooms.find_one({'name': 'R-7A'})
        class7a = await db.classes.find_one({'name': '7A'})
        subj_mtk = await db.subjects.find_one({'code': 'MTK'})
        if not (guru1 and room7a and class7a and subj_mtk):
            return

        now = now_wib()
        today = current_day_id()

        # Check if there's already an active schedule for guru1/R-7A today
        schedules = await db.schedules.find({
            'teacher_id': guru1['id'], 'room_id': room7a['id'],
            'day': today, 'academic_year_id': ay['id'],
        }).to_list(20)

        has_active = False
        for s in schedules:
            try:
                sh, sm = map(int, s['start_time'].split(':'))
                eh, em = map(int, s['end_time'].split(':'))
                start = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
                end = now.replace(hour=eh, minute=em, second=0, microsecond=0)
                if start - timedelta(minutes=15) <= now <= end + timedelta(minutes=15):
                    has_active = True
                    break
            except Exception:
                pass

        if has_active:
            print(f"[refresh] Active schedule exists for guru1/R-7A today ({today})")
            return

        # Create a fresh active-now schedule
        active_start = now - timedelta(minutes=5)
        active_end = now + timedelta(minutes=40)
        new_sched = {
            'id': str(uuid.uuid4()),
            'academic_year_id': ay['id'], 'semester': 'ganjil',
            'class_id': class7a['id'], 'subject_id': subj_mtk['id'],
            'teacher_id': guru1['id'], 'room_id': room7a['id'],
            'day': today,
            'start_time': active_start.strftime('%H:%M'),
            'end_time': active_end.strftime('%H:%M'),
            'is_published': True, 'created_at': datetime.utcnow().isoformat(),
        }
        await db.schedules.insert_one(new_sched)
        print(f"[refresh] Created active-now schedule: guru1 Matematika @ R-7A {new_sched['start_time']}-{new_sched['end_time']} ({today})")
    except Exception as e:
        print(f"[refresh] Error: {e}")


if __name__ == '__main__':
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(Path(__file__).parent / '.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    asyncio.run(seed_all(db))
    asyncio.run(refresh_demo_schedule(db))
