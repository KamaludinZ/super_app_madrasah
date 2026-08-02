"""
Comprehensive Data Seeder for Super Apps MATSANDATAMA
Adds complete sample data for all features to test the application.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from motor.motor_asyncio import AsyncIOMotorClient
from auth_utils import hash_password

WIB_TZ = timezone(timedelta(hours=7))

def now_wib():
    return datetime.now(WIB_TZ)

async def seed_comprehensive_data(db: Any):
    """Seed comprehensive data for all features"""

    print("[SEED] Starting comprehensive data seeding...")

    # Current academic year
    current_year = "2025/2026"
    fiscal_year = "2025/2026"

    # ============================================================
    # 1. RKAM BUDGET ITEMS (Rencana Kegiatan dan Anggaran Madrasah)
    # ============================================================
    print("[SEED] Creating RKAM budget items...")

    rkam_items = [
        # BOS - Operasional
        {
            'id': str(uuid.uuid4()),
            'code': '1.1.1',
            'name': 'Pengadaan Buku Pelajaran Kelas 7',
            'category': 'Operasional',
            'bidang': 'kurikulum',
            'sumber_dana': 'BOS',
            'description': 'Pembelian buku paket untuk siswa kelas 7 semua mata pelajaran',
            'allocated_amount': 35000000.0,
            'realized_amount': 28500000.0,
            'remaining_amount': 6500000.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q1',
            'month': 7,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'code': '1.1.2',
            'name': 'Pengadaan Buku Pelajaran Kelas 8',
            'category': 'Operasional',
            'bidang': 'kurikulum',
            'sumber_dana': 'BOS',
            'description': 'Pembelian buku paket untuk siswa kelas 8 semua mata pelajaran',
            'allocated_amount': 32000000.0,
            'realized_amount': 32000000.0,
            'remaining_amount': 0.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q1',
            'month': 7,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'code': '1.2.1',
            'name': 'Pemeliharaan Komputer Lab',
            'category': 'Operasional',
            'bidang': 'sarana_prasarana',
            'sumber_dana': 'BOS',
            'description': 'Service dan perawatan komputer laboratorium komputer',
            'allocated_amount': 15000000.0,
            'realized_amount': 8500000.0,
            'remaining_amount': 6500000.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q2',
            'month': 10,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'code': '1.3.1',
            'name': 'Kegiatan Literasi dan Numerasi',
            'category': 'Program',
            'bidang': 'kurikulum',
            'sumber_dana': 'BOS',
            'description': 'Program peningkatan literasi dan numerasi siswa',
            'allocated_amount': 20000000.0,
            'realized_amount': 15000000.0,
            'remaining_amount': 5000000.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q3',
            'month': 1,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        # KOMITE - Pembangunan
        {
            'id': str(uuid.uuid4()),
            'code': '2.1.1',
            'name': 'Renovasi Ruang Kelas 7A dan 7B',
            'category': 'Pembangunan',
            'bidang': 'sarana_prasarana',
            'sumber_dana': 'KOMITE',
            'description': 'Perbaikan lantai, cat, dan atap ruang kelas 7A dan 7B',
            'allocated_amount': 45000000.0,
            'realized_amount': 30000000.0,
            'remaining_amount': 15000000.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q2',
            'month': 11,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'code': '2.2.1',
            'name': 'Pengadaan AC Ruang Guru',
            'category': 'Pembangunan',
            'bidang': 'sarana_prasarana',
            'sumber_dana': 'KOMITE',
            'description': 'Pembelian dan instalasi AC untuk ruang guru',
            'allocated_amount': 25000000.0,
            'realized_amount': 25000000.0,
            'remaining_amount': 0.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q1',
            'month': 8,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'code': '2.3.1',
            'name': 'Kegiatan Ekstrakulikuler',
            'category': 'Program',
            'bidang': 'kesiswaan',
            'sumber_dana': 'KOMITE',
            'description': 'Dana operasional kegiatan ekstrakurikuler (Pramuka, PMR, Paskibra)',
            'allocated_amount': 18000000.0,
            'realized_amount': 12000000.0,
            'remaining_amount': 6000000.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q3',
            'month': 2,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        # BOS - Pendidikan
        {
            'id': str(uuid.uuid4()),
            'code': '1.4.1',
            'name': 'Pelatihan Guru Kurikulum Merdeka',
            'category': 'Pendidikan',
            'bidang': 'kurikulum',
            'sumber_dana': 'BOS',
            'description': 'Workshop dan pelatihan implementasi kurikulum merdeka',
            'allocated_amount': 22000000.0,
            'realized_amount': 18000000.0,
            'remaining_amount': 4000000.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q1',
            'month': 8,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'code': '1.5.1',
            'name': 'Kegiatan Humas dan Publikasi',
            'category': 'Operasional',
            'bidang': 'humas',
            'sumber_dana': 'BOS',
            'description': 'Biaya publikasi kegiatan madrasah dan media sosial',
            'allocated_amount': 12000000.0,
            'realized_amount': 7500000.0,
            'remaining_amount': 4500000.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q2',
            'month': 10,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'code': '1.6.1',
            'name': 'Administrasi Tata Usaha',
            'category': 'Operasional',
            'bidang': 'tata_usaha',
            'sumber_dana': 'BOS',
            'description': 'Kebutuhan administrasi dan ATK tata usaha',
            'allocated_amount': 10000000.0,
            'realized_amount': 8000000.0,
            'remaining_amount': 2000000.0,
            'fiscal_year': fiscal_year,
            'quarter': 'Q4',
            'month': 5,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        },
    ]

    for item in rkam_items:
        existing = await db.rkam_budget_items.find_one({'code': item['code'], 'fiscal_year': fiscal_year})
        if not existing:
            await db.rkam_budget_items.insert_one(item)

    print(f"[SEED] Created {len(rkam_items)} RKAM budget items")

    # ============================================================
    # 2. RKAM DOCUMENTS
    # ============================================================
    print("[SEED] Creating RKAM documents...")

    rkam_documents = [
        {
            'id': str(uuid.uuid4()),
            'title': 'Laporan Realisasi Anggaran Q1',
            'description': 'Laporan realisasi anggaran triwulan 1 tahun anggaran 2025/2026',
            'document_type': 'Laporan',
            'file_url': 'https://example.com/docs/laporan-q1-2025.pdf',
            'file_name': 'Laporan_Q1_2025-2026.pdf',
            'fiscal_year': fiscal_year,
            'quarter': 'Q1',
            'is_public': True,
            'upload_date': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'title': 'Rencana Kegiatan dan Anggaran Madrasah 2025/2026',
            'description': 'Dokumen perencanaan RKAM lengkap untuk tahun anggaran 2025/2026',
            'document_type': 'Proposal',
            'file_url': 'https://example.com/docs/rkam-2025-2026.pdf',
            'file_name': 'RKAM_2025-2026_Full.pdf',
            'fiscal_year': fiscal_year,
            'quarter': None,
            'is_public': True,
            'upload_date': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'title': 'Bukti Realisasi BOS Q2',
            'description': 'Kumpulan bukti pembayaran realisasi dana BOS triwulan 2',
            'document_type': 'Bukti',
            'file_url': 'https://example.com/docs/bukti-bos-q2.pdf',
            'file_name': 'Bukti_BOS_Q2.pdf',
            'fiscal_year': fiscal_year,
            'quarter': 'Q2',
            'is_public': False,
            'upload_date': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
        },
    ]

    for doc in rkam_documents:
        existing = await db.rkam_documents.find_one({'title': doc['title'], 'fiscal_year': fiscal_year})
        if not existing:
            await db.rkam_documents.insert_one(doc)

    print(f"[SEED] Created {len(rkam_documents)} RKAM documents")

    # ============================================================
    # 3. ACHIEVEMENTS (Prestasi)
    # ============================================================
    print("[SEED] Creating achievements...")

    achievements = [
        {
            'id': str(uuid.uuid4()),
            'name': 'Juara 1 Olimpiade Matematika Tingkat Kota',
            'category': 'Akademik',
            'level': 'Kabupaten/Kota',
            'achievement_date': '2025-09-15',
            'year': 2025,
            'holder_type': 'siswa',
            'holder_name': 'Ahmad Rizky Pratama',
            'holder_class': '8A',
            'organizer': 'Dinas Pendidikan Kota Malang',
            'description': 'Juara 1 Olimpiade Matematika SMP se-Kota Malang',
            'certificate_url': 'https://example.com/certificates/olimpiade-math-2025.pdf',
            'is_public': True,
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Juara 2 Lomba Karya Tulis Ilmiah Tingkat Provinsi',
            'category': 'Akademik',
            'level': 'Provinsi',
            'achievement_date': '2025-10-20',
            'year': 2025,
            'holder_type': 'siswa',
            'holder_name': 'Siti Nurhaliza',
            'holder_class': '9B',
            'organizer': 'Dinas Pendidikan Provinsi Jawa Timur',
            'description': 'Juara 2 KTI SMP se-Jawa Timur dengan tema Lingkungan',
            'certificate_url': 'https://example.com/certificates/kti-2025.pdf',
            'is_public': True,
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Juara 1 Pramuka Penggalang Tingkat Nasional',
            'category': 'Non-Akademik',
            'level': 'Nasional',
            'achievement_date': '2025-08-17',
            'year': 2025,
            'holder_type': 'siswa',
            'holder_name': 'Regu Pramuka MTsN 2 Kota Malang',
            'holder_class': '8A, 8B',
            'organizer': 'Kwartir Nasional Gerakan Pramuka',
            'description': 'Juara 1 Lomba Regu Penggalang Tingkat Nasional',
            'certificate_url': 'https://example.com/certificates/pramuka-2025.pdf',
            'is_public': True,
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Guru Berprestasi Tingkat Kota',
            'category': 'Guru',
            'level': 'Kabupaten/Kota',
            'achievement_date': '2025-11-12',
            'year': 2025,
            'holder_type': 'guru',
            'holder_name': 'Dra. Siti Aminah, M.Pd',
            'holder_class': None,
            'organizer': 'Kementerian Agama Kota Malang',
            'description': 'Guru Berprestasi Tingkat Kota Malang 2025',
            'certificate_url': 'https://example.com/certificates/guru-berprestasi-2025.pdf',
            'is_public': True,
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Madrasah Adiwiyata Tingkat Provinsi',
            'category': 'Madrasah',
            'level': 'Provinsi',
            'achievement_date': '2025-06-05',
            'year': 2025,
            'holder_type': 'madrasah',
            'holder_name': 'MTsN 2 Kota Malang',
            'holder_class': None,
            'organizer': 'Kementerian Lingkungan Hidup Jawa Timur',
            'description': 'Penghargaan Madrasah Adiwiyata tingkat Provinsi Jawa Timur',
            'certificate_url': 'https://example.com/certificates/adiwiyata-2025.pdf',
            'is_public': True,
            'created_at': datetime.utcnow().isoformat(),
        },
    ]

    for achievement in achievements:
        existing = await db.achievements.find_one({'name': achievement['name'], 'year': achievement['year']})
        if not existing:
            await db.achievements.insert_one(achievement)

    print(f"[SEED] Created {len(achievements)} achievements")

    # ============================================================
    # 4. ANNOUNCEMENTS (Pengumuman)
    # ============================================================
    print("[SEED] Creating announcements...")

    announcements = [
        {
            'id': str(uuid.uuid4()),
            'title': 'Libur Semester Ganjil',
            'content': 'Libur semester ganjil akan dimulai tanggal 20 Desember 2025 sampai 5 Januari 2026. Siswa diharapkan memanfaatkan waktu libur dengan kegiatan positif.',
            'category': 'umum',
            'priority': 'high',
            'target_roles': ['siswa', 'guru', 'wali_kelas'],
            'is_public': True,
            'published_at': datetime.utcnow().isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(days=60)).isoformat(),
            'created_by': 'admin',
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'title': 'Pendaftaran Ekstrakurikuler Semester Genap',
            'content': 'Pendaftaran kegiatan ekstrakurikuler semester genap dibuka mulai tanggal 10 Januari 2026. Tersedia: Pramuka, PMR, Paskibra, Bahasa Inggris, Komputer, dan Seni.',
            'category': 'kesiswaan',
            'priority': 'normal',
            'target_roles': ['siswa'],
            'is_public': True,
            'published_at': datetime.utcnow().isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),
            'created_by': 'admin',
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'title': 'Rapat Koordinasi Guru - Wajib Hadir',
            'content': 'Rapat koordinasi guru dan wali kelas akan dilaksanakan pada Senin, 15 Januari 2026 pukul 13.00 WIB di Aula. Kehadiran wajib.',
            'category': 'akademik',
            'priority': 'urgent',
            'target_roles': ['guru', 'wali_kelas'],
            'is_public': False,
            'published_at': datetime.utcnow().isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(days=10)).isoformat(),
            'created_by': 'admin',
            'created_at': datetime.utcnow().isoformat(),
        },
    ]

    for announcement in announcements:
        existing = await db.announcements.find_one({'title': announcement['title']})
        if not existing:
            await db.announcements.insert_one(announcement)

    print(f"[SEED] Created {len(announcements)} announcements")

    # ============================================================
    # 5. HOLIDAYS (Hari Libur)
    # ============================================================
    print("[SEED] Creating holidays...")

    holidays = [
        {
            'id': str(uuid.uuid4()),
            'name': 'Tahun Baru 2026',
            'date': '2026-01-01',
            'category': 'nasional',
            'description': 'Hari libur nasional perayaan tahun baru',
            'is_academic_holiday': True,
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Isra Miraj',
            'date': '2026-02-14',
            'category': 'keagamaan',
            'description': 'Hari libur nasional Isra Miraj Nabi Muhammad SAW',
            'is_academic_holiday': True,
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Hari Raya Idul Fitri',
            'date': '2026-03-31',
            'category': 'keagamaan',
            'description': 'Hari Raya Idul Fitri 1 Syawal',
            'is_academic_holiday': True,
            'created_at': datetime.utcnow().isoformat(),
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Cuti Bersama Lebaran',
            'date': '2026-04-01',
            'category': 'nasional',
            'description': 'Cuti bersama hari raya Idul Fitri',
            'is_academic_holiday': True,
            'created_at': datetime.utcnow().isoformat(),
        },
    ]

    for holiday in holidays:
        existing = await db.holidays.find_one({'date': holiday['date']})
        if not existing:
            await db.holidays.insert_one(holiday)

    print(f"[SEED] Created {len(holidays)} holidays")

    print("[SEED] SUCCESS! Comprehensive data seeding completed!")
    print("[SEED] You can now test all features in the application.")


async def main():
    # Connect to MongoDB
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("MONGO_DB_NAME", "super_app_madrasah")

    print(f"[SEED] Connecting to MongoDB: {MONGO_URL}")
    print(f"[SEED] Database: {DB_NAME}")

    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]

        # Test connection
        await client.admin.command('ping')
        print("[SEED] SUCCESS! MongoDB connection successful!")

        await seed_comprehensive_data(db)
    except Exception as e:
        print(f"[SEED] ERROR: {e}")
        print("[SEED] Make sure MongoDB is running!")
        print("[SEED] Start MongoDB service or check MONGO_URL environment variable")
    finally:
        if 'client' in locals():
            client.close()


if __name__ == "__main__":
    asyncio.run(main())
