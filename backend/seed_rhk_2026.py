"""
Seed RHK (Rencana Hasil Kerja) 2026 dari CASCADE / Matrik Pembagian Peran dan
Hasil MTsN 2 Kota Malang (sheet "RENCANA AKSI123"). Setiap baris Rencana Aksi
di file sumber menjadi satu dokumen RHK, terbuka untuk diambil GTK mana pun,
difilter berdasarkan leading sektor (Unit/Tim Penerima Mandat).

Usage:
    python seed_rhk_2026.py "<path-ke-file-xlsx>"
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime

import openpyxl
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'super_app_madrasah')

BULAN_LIST = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
              'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

UNIT_NAME_TO_LEADING_SEKTOR = {
    'Ka. TU': 'Kepala Tata Usaha',
    'Tim Penjamin Mutu': 'Tim Penjamin Mutu',
    'Waka Humas': 'Waka Humas',
    'Waka Sarpras': 'Waka Sarpras',
    'Waka Kesiswaan': 'Waka Kesiswaan',
    'Waka Kurikulum': 'Waka Kurikulum',
}


def extract_rows(xlsx_path: str):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb['RENCANA AKSI123']

    rows = []
    last_sk = last_sasaran = last_iksk = last_indikator = None
    for row in ws.iter_rows(min_row=9, max_row=1001):
        kegiatan = row[1].value
        sasaran = row[2].value
        iksk = row[3].value
        indikator = row[4].value
        unit_name = row[6].value
        rencana_aksi = row[7].value
        months = [BULAN_LIST[i] for i, c in enumerate(row[11:23]) if c.value]
        output = row[27].value if len(row) > 27 else None

        if kegiatan:
            last_sk = kegiatan
        if sasaran:
            last_sasaran = sasaran
        if iksk:
            last_iksk = iksk
        if indikator:
            last_indikator = indikator

        if not rencana_aksi or not unit_name:
            continue

        leading_sektor = UNIT_NAME_TO_LEADING_SEKTOR.get(str(unit_name).strip())
        if not leading_sektor:
            continue  # skip any unit name outside the 6 known leading sektor categories

        rows.append({
            'sk': last_sk,
            'sasaran': last_sasaran,
            'iksk': last_iksk,
            'indikator': last_indikator,
            'leading_sektor': leading_sektor,
            'rencana_aksi': str(rencana_aksi).strip(),
            'months': months,
            'output': str(output).strip() if output else None,
        })
    return rows


async def seed(xlsx_path: str):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    rows = extract_rows(xlsx_path)
    print(f"Extracted {len(rows)} Rencana Aksi rows from source file.")

    existing = await db.ekinerja_rhk.count_documents({'year': 2026, 'source': 'cascade_2026_seed'})
    if existing > 0:
        print(f"Found {existing} RHK 2026 records already seeded from this source. Skipping to avoid duplicates.")
        print("Delete them first with: db.ekinerja_rhk.delete_many({'source': 'cascade_2026_seed'}) if you want to re-seed.")
        client.close()
        return

    docs = []
    now = datetime.utcnow().isoformat()
    for r in rows:
        aspek_parts = [p for p in (r['iksk'], r['indikator']) if p]
        aspek = ' - '.join(str(p) for p in aspek_parts) if aspek_parts else None
        rhk_atasan = r['sasaran'] or r['sk'] or ''

        doc = {
            'id': str(uuid.uuid4()),
            'year': 2026,
            'rhk_atasan': str(rhk_atasan).strip(),
            'leading_sektor': r['leading_sektor'],
            'aspek': aspek,
            'indikator_kinerja_individu': r['rencana_aksi'],
            'target': r['sk'],
            'target_kuantitas': None,
            'target_kualitas': None,
            'target_waktu': None,
            'target_biaya': None,
            'perilaku_kerja': [],
            'bulan_berlaku': r['months'],
            'output_url': r['output'],
            'claimed_by': None,
            'claimed_by_name': None,
            'claimed_at': None,
            'is_locked': False,
            'created_by': None,
            'created_by_name': 'Seed CASCADE 2026',
            'created_at': now,
            'updated_at': now,
            'source': 'cascade_2026_seed',
        }
        docs.append(doc)

    if docs:
        await db.ekinerja_rhk.insert_many(docs)
    print(f"Inserted {len(docs)} RHK records for year 2026.")

    by_sektor = {}
    for d in docs:
        by_sektor[d['leading_sektor']] = by_sektor.get(d['leading_sektor'], 0) + 1
    for sektor, count in sorted(by_sektor.items()):
        print(f"  - {sektor}: {count}")

    client.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python seed_rhk_2026.py <path-ke-file-xlsx>")
        sys.exit(1)
    asyncio.run(seed(sys.argv[1]))
