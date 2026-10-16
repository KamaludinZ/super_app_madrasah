"""
Migration: master jenis pelanggaran — normalisasi data jenis aturan (koleksi tatib_aturan)

Melengkapi migrate_tatib_struktur_baru. Script ini (aman dijalankan berulang kali):
1. Menormalkan kode_aturan menjadi HURUF BESAR tanpa spasi (normalisasi_kode). Kode yang bentrok
   setelah dinormalkan tidak diubah dan dilaporkan.
2. Merapikan jalur_poin ('minus'|'plus'), besar_poin (bilangan bulat >= 0), dan aktif (boolean).
3. Memastikan index unik kode_aturan ada (bila sebelumnya dilewati karena data ganda yang kini sudah
   diperbaiki) serta index pencarian pencatatan per jenis.

Jalankan dari folder backend:
    python migrations/migrate_tatib_jenis_pelanggaran.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError, OperationFailure

from tatib_poin import INDEX_STRUKTUR, JALUR_MINUS, JALUR_POIN, KOLEKSI_POIN, field_jenis_aturan, normalisasi_kode

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


def _rapikan(a: dict) -> dict:
    """Field jenis yang perlu diperbaiki (kosong bila sudah rapi)."""
    f = field_jenis_aturan(a)
    isian = {}
    if a.get('jalur_poin') not in JALUR_POIN:
        isian['jalur_poin'] = f['jalur_poin'] if f['jalur_poin'] in JALUR_POIN else JALUR_MINUS
    besar = a.get('besar_poin')
    if not isinstance(besar, int) or isinstance(besar, bool) or besar < 0:
        isian['besar_poin'] = f['besar_poin']
    if not isinstance(a.get('aktif'), bool):
        isian['aktif'] = bool(f['aktif'])
    if a.get('nama') is None and f['nama'] is not None:
        isian['nama'] = f['nama']
    return isian


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    aturan = await db.tatib_aturan.find({}, {'_id': 1, 'id': 1, 'kode': 1, 'kode_aturan': 1, 'nama': 1, 'nama_aturan': 1,
                                             'jalur_poin': 1, 'jenis_poin': 1, 'besar_poin': 1, 'poin': 1,
                                             'aktif': 1, 'is_active': 1}).to_list(None)
    # 1. kode
    target = {}
    for a in aturan:
        kode = a.get('kode_aturan') or a.get('kode')
        if kode:
            target.setdefault(normalisasi_kode(kode), []).append(a)
    kode_diubah, bentrok = 0, []
    for kode, daftar in target.items():
        if len(daftar) > 1:
            bentrok.append(kode)
            continue
        a = daftar[0]
        if a.get('kode_aturan') != kode:
            await db.tatib_aturan.update_one({'_id': a['_id']}, {'$set': {'kode_aturan': kode, 'kode': kode}})
            kode_diubah += 1

    # 2. jalur, besar poin, aktif, nama
    dirapikan = 0
    for a in aturan:
        isian = _rapikan(a)
        if isian:
            await db.tatib_aturan.update_one({'_id': a['_id']}, {'$set': isian})
            dirapikan += 1

    # 3. index (unik kode dilewati selama masih ada kode bentrok)
    index = {}
    daftar_index = [('tatib_aturan', keys, opsi) for keys, opsi in INDEX_STRUKTUR['tatib_aturan']]
    daftar_index += [(KOLEKSI_POIN, keys, opsi) for keys, opsi in INDEX_STRUKTUR[KOLEKSI_POIN] if keys[0][0] == 'jenis_id']
    for koleksi, keys, opsi in daftar_index:
        nama = opsi.get('name') or '_'.join(f'{k}_{arah}' for k, arah in keys)
        if opsi.get('unique') and bentrok:
            index[nama] = 'dilewati'
            continue
        try:
            await db[koleksi].create_index(keys, **opsi)
            index[nama] = 'ok'
        except (DuplicateKeyError, OperationFailure):
            index[nama] = 'dilewati'

    return {'kode_dinormalkan': kode_diubah, 'kode_bentrok': sorted(bentrok), 'jenis_dirapikan': dirapikan, 'index': index}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: tatib jenis pelanggaran\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
