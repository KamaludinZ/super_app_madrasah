"""
Migration: struktur baru tata tertib — kategori -> jenis aturan -> pencatatan poin

Skema ada di tatib_poin.py (bagian STRUKTUR BARU). Script ini (aman dijalankan berulang kali):
1. Kategori: mengisi `nama_key` (nama huruf kecil) untuk mencegah nama kategori ganda.
2. Jenis aturan (`tatib_aturan`): mengisi field kanonis kode_aturan, nama, jalur_poin,
   besar_poin, dan aktif dari field lama (kode, nama_aturan, jenis_poin/poin, is_active).
3. Pencatatan (`tatib_penanganan`): mengisi jenis_id (= tatib_id), kategori_id (dari aturan),
   keterangan (= catatan), dan asal_input = None untuk catatan lama.
4. Membuat index: nama kategori & kode aturan unik, serta index daftar pencatatan.
   Bila data lama masih memiliki nilai ganda, index unik dilewati dan nilai gandanya dilaporkan
   (perbaiki datanya, lalu jalankan ulang script ini).

Jalankan dari folder backend:
    python migrations/migrate_tatib_struktur_baru.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError, OperationFailure

from tatib_poin import INDEX_STRUKTUR, KOLEKSI_POIN, field_jenis_aturan, kunci_nama

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


def _belum_ada(*fields: str) -> dict:
    return {'$or': [{f: {'$exists': False}} for f in fields]}


def _ganda(nilai) -> list:
    lihat, ganda = set(), set()
    for v in nilai:
        if v in lihat:
            ganda.add(v)
        lihat.add(v)
    return sorted(ganda)


async def _buat_index(db, koleksi: str, keys, opsi: dict, ganda: list) -> str:
    """Buat satu index; index unik dilewati bila data masih ganda. -> 'ok' | 'dilewati'."""
    if opsi.get('unique') and ganda:
        return 'dilewati'
    try:
        await db[koleksi].create_index(keys, **opsi)
    except (DuplicateKeyError, OperationFailure):
        return 'dilewati'
    return 'ok'


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    # 1. Kategori
    kategori = await db.tatib_kategori.find({}, {'_id': 1, 'id': 1, 'nama': 1, 'nama_key': 1}).to_list(None)
    kategori_diisi = 0
    for k in kategori:
        if k.get('nama_key') is None:
            k['nama_key'] = kunci_nama(k.get('nama'))
            await db.tatib_kategori.update_one({'_id': k['_id']}, {'$set': {'nama_key': k['nama_key']}})
            kategori_diisi += 1
    kategori_ganda = _ganda(k['nama_key'] for k in kategori if k.get('nama_key'))

    # 2. Jenis aturan
    aturan = await db.tatib_aturan.find({}).to_list(None)
    aturan_diisi = 0
    for a in aturan:
        if all(a.get(f) is not None for f in ('kode_aturan', 'nama', 'jalur_poin', 'besar_poin', 'aktif')):
            continue
        isian = field_jenis_aturan(a)
        a.update(isian)
        await db.tatib_aturan.update_one({'_id': a['_id']}, {'$set': isian})
        aturan_diisi += 1
    kode_ganda = _ganda(a['kode_aturan'] for a in aturan if isinstance(a.get('kode_aturan'), str))

    # 3. Pencatatan poin
    kategori_aturan = {a['id']: a.get('kategori_id') for a in aturan if a.get('id')}
    catatan = await db[KOLEKSI_POIN].find(
        _belum_ada('jenis_id', 'kategori_id', 'keterangan', 'asal_input'),
        {'_id': 1, 'tatib_id': 1, 'catatan': 1, 'jenis_id': 1, 'kategori_id': 1, 'keterangan': 1, 'asal_input': 1},
    ).to_list(None)
    for c in catatan:
        isian = {}
        if 'jenis_id' not in c:
            isian['jenis_id'] = c.get('tatib_id')
        if 'kategori_id' not in c:
            isian['kategori_id'] = kategori_aturan.get(c.get('jenis_id') or c.get('tatib_id'))
        if 'keterangan' not in c:
            isian['keterangan'] = c.get('catatan')
        if 'asal_input' not in c:
            isian['asal_input'] = None
        await db[KOLEKSI_POIN].update_one({'_id': c['_id']}, {'$set': isian})

    # 4. Index
    ganda = {'tatib_kategori': kategori_ganda, 'tatib_aturan': kode_ganda}
    index = {}
    for koleksi, daftar in INDEX_STRUKTUR.items():
        for keys, opsi in daftar:
            nama = opsi.get('name') or '_'.join(f'{k}_{arah}' for k, arah in keys)
            index[f'{koleksi}.{nama}'] = await _buat_index(db, koleksi, keys, opsi, ganda.get(koleksi, []))

    return {
        'kategori_diisi': kategori_diisi,
        'aturan_diisi': aturan_diisi,
        'catatan_diisi': len(catatan),
        'kategori_ganda': kategori_ganda,
        'kode_aturan_ganda': kode_ganda,
        'index': index,
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: tatib struktur baru\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
