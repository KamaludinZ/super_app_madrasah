"""
Migration: siapkan master wilayah Indonesia (koleksi `wilayah`)

Script ini:
1. Membuat koleksi `wilayah` dan index-nya (kode unik, induk+nama, kode pos, nama_key).
2. --seed-provinsi: mengisi 38 provinsi (kode Kemendagri) bila belum ada.
3. Mengisi data lengkap provinsi -> desa/kelurahan + kode pos (pilih salah satu):
   --unduh                 unduh dump SQL cahyadsn (MIT, Kepmendagri 300.2.2-2138/2025) lalu muat
   --sql <wilayah.sql> [--sql-kodepos <wilayah_kodepos.sql>]   muat dari berkas SQL yang sudah diunduh
   --paket <berkas.csv|xlsx>                                   muat paket (kode, nama, kode_pos)
   --keluaran <paket.csv>  (bersama --unduh/--sql) simpan juga paket CSV untuk diunggah lewat menu Master Wilayah
4. --cocokkan-alamat: cocokkan alamat siswa (ayah/ibu/wali/domisili) & GTK yang sudah tersimpan tetapi belum
   ber-kode wilayah ke master (nama resmi + kode wilayah + kode pos bila kosong). Tambah --dry-run untuk
   hanya melihat hitungan tanpa menyimpan.
5. Melaporkan jumlah wilayah per tingkat.

Aman dijalankan berulang kali (upsert per kode, tidak menghapus). Jalankan dari folder backend:
    python migrations/migrate_master_wilayah.py --seed-provinsi --unduh
"""
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, seed: bool = False, paket: str = None, isi_paket: bytes = None,
                  cocokkan: bool = False, dry_run: bool = False) -> dict:
    from wilayah_master import KOLEKSI_WILAYAH, TINGKAT_WILAYAH, ensure_wilayah_indexes, seed_provinsi

    hasil = {'index_gagal': await ensure_wilayah_indexes(db), 'provinsi_baru': 0, 'paket': None}
    sekarang = datetime.now(timezone.utc).isoformat()
    if seed:
        hasil['provinsi_baru'] = await seed_provinsi(db, sekarang)
    if paket or isi_paket:
        from wilayah_impor import impor_paket_wilayah
        if isi_paket is None:
            with open(paket, 'rb') as f:
                isi_paket = f.read()
        hasil['paket'] = await impor_paket_wilayah(db, isi_paket, os.path.basename(paket or 'wilayah.csv'))
    hasil['jumlah'] = {t: await db[KOLEKSI_WILAYAH].count_documents({'tingkat': t}) for t in TINGKAT_WILAYAH}
    if cocokkan:
        from wilayah_cocok import cocokkan_alamat_tersimpan
        hasil['alamat'] = await cocokkan_alamat_tersimpan(db, terapkan=not dry_run)
    return hasil


async def main():
    seed = '--seed-provinsi' in sys.argv
    arg = lambda nama: sys.argv[sys.argv.index(nama) + 1] if nama in sys.argv else None  # noqa: E731
    paket, isi_paket = arg('--paket'), None
    if '--unduh' in sys.argv or arg('--sql'):
        from wilayah_sumber import URL_KODEPOS, URL_WILAYAH, baris_paket_dari_sql, paket_csv, unduh
        if '--unduh' in sys.argv:
            print(f"[..] Mengunduh {URL_WILAYAH}")
            sql_w = unduh(URL_WILAYAH)
            print(f"[..] Mengunduh {URL_KODEPOS}")
            sql_k = unduh(URL_KODEPOS)
        else:
            with open(arg('--sql'), encoding='utf-8-sig') as f:
                sql_w = f.read()
            sql_k = ''
            if arg('--sql-kodepos'):
                with open(arg('--sql-kodepos'), encoding='utf-8-sig') as f:
                    sql_k = f.read()
        baris = baris_paket_dari_sql(sql_w, sql_k)
        isi_paket = paket_csv(baris)
        print(f"[OK] {len(baris)} wilayah dibaca dari sumber SQL")
        if arg('--keluaran'):
            with open(arg('--keluaran'), 'wb') as f:
                f.write(isi_paket)
            print(f"[OK] Paket CSV disimpan: {arg('--keluaran')}")
    client = AsyncIOMotorClient(MONGO_URL)
    print(">>> Starting migration: master wilayah\n")
    h = await migrate(client[DB_NAME], seed, paket, isi_paket, '--cocokkan-alamat' in sys.argv, '--dry-run' in sys.argv)
    if h['index_gagal']:
        print("[WARN] Sebagian index gagal dibuat:")
        for g in h['index_gagal']:
            print(f"  - {g}")
    else:
        print("[OK] Index wilayah siap")
    if seed:
        print(f"[OK] {h['provinsi_baru']} provinsi baru ditambahkan")
    if h['paket']:
        p = h['paket']
        print(f"[OK] Paket: {p['baru']} baru, {p['diperbarui']} diperbarui, {p['gagal']} gagal dari {p['total']} baris")
    print("[INFO] Jumlah: " + ', '.join(f"{k} {v}" for k, v in h['jumlah'].items()))
    if h.get('alamat'):
        a = h['alamat']
        print(f"[{'DRY-RUN' if '--dry-run' in sys.argv else 'OK'}] Alamat: {a['cocok']} cocok, {a['sebagian']} sebagian, {a['tidak_cocok']} tidak cocok, "
              f"{a['tanpa_alamat']} tanpa alamat, {a['dilewati']} sudah ber-kode; {a['diperbarui']} data {'akan ' if '--dry-run' in sys.argv else ''}diperbarui")
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
