"""Skema poin tatib: kebaikan PLUS, pelanggaran MINUS, dan migrasi catatan lama."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from tatib_poin import field_poin, jenis_dari_poin, poin_bertanda  # noqa: E402
from migrations.migrate_tatib_poin import migrate  # noqa: E402


def test_jenis_dan_tanda_poin():
    assert jenis_dari_poin(10) == 'kebaikan'
    assert jenis_dari_poin(-5) == 'pelanggaran'
    assert jenis_dari_poin(None) == 'kebaikan'
    assert poin_bertanda(5, 'pelanggaran') == -5
    assert poin_bertanda(-7, 'kebaikan') == 7
    assert field_poin(-3, 'Pertama') == {'jenis_poin': 'pelanggaran', 'poin': -3, 'kondisi': 'Pertama'}


class _Hasil:
    def __init__(self, n):
        self.modified_count = n


class _Cursor:
    def __init__(self, docs):
        self._docs = docs

    async def to_list(self, _n):
        return self._docs


class _Koleksi:
    """Tiruan minimal koleksi Mongo untuk filter yang dipakai migrasi."""

    def __init__(self, docs):
        self.docs = docs
        self.indexes = []

    @staticmethod
    def _cocok(d, q):
        if '$or' in q:
            return any(_Koleksi._cocok(d, sub) for sub in q['$or'])
        for k, v in q.items():
            if k == '_id':
                if d['_id'] != v:
                    return False
            elif isinstance(v, dict) and '$exists' in v:
                if (k in d) != v['$exists']:
                    return False
            elif d.get(k, 'TIDAK_ADA') != v:
                return False
        return True

    def find(self, q, _proj=None):
        return _Cursor([d for d in self.docs if self._cocok(d, q)])

    async def update_one(self, q, u):
        for d in self.docs:
            if self._cocok(d, q):
                d.update(u['$set'])
                return _Hasil(1)
        return _Hasil(0)

    async def update_many(self, q, u):
        cocok = [d for d in self.docs if self._cocok(d, q)]
        for d in cocok:
            d.update(u['$set'])
        return _Hasil(len(cocok))

    async def create_index(self, keys, **_kw):
        self.indexes.append(keys)

    async def count_documents(self, _q):
        return len(self.docs)


def test_migrasi_mengisi_catatan_lama_dan_aman_diulang():
    koll = _Koleksi([
        {'_id': 1, 'tatib_poin': -5},
        {'_id': 2, 'tatib_poin': 10},
        {'_id': 3, 'tatib_poin': -2, 'jenis_poin': 'pelanggaran', 'poin': -2, 'kondisi': 'x', 'tindak_lanjut': [{'uraian': 'a'}]},
    ])
    db = {'tatib_penanganan': koll}

    hasil = asyncio.run(migrate(db))
    assert hasil['jenis_diisi'] == 2
    assert koll.docs[0] == {'_id': 1, 'tatib_poin': -5, 'jenis_poin': 'pelanggaran', 'poin': -5, 'kondisi': None, 'tindak_lanjut': []}
    assert koll.docs[1]['jenis_poin'] == 'kebaikan' and koll.docs[1]['poin'] == 10
    assert koll.docs[2]['tindak_lanjut'] == [{'uraian': 'a'}] and koll.docs[2]['kondisi'] == 'x'
    assert [('siswa_id', 1), ('tanggal', -1)] in koll.indexes

    ulang = asyncio.run(migrate(db))
    assert ulang['jenis_diisi'] == 0 and ulang['kondisi_diisi'] == 0 and ulang['tindak_lanjut_diisi'] == 0


# ---- Aturan: nilai mengikuti kategori & kondisi ----
from tatib_poin import hitung_poin_aturan, kondisi_aturan, normalisasi_kondisi  # noqa: E402
from migrations.migrate_tatib_aturan_kondisi import migrate as migrate_aturan  # noqa: E402


class _Db(dict):
    def __getattr__(self, nama):
        return self[nama]


def test_normalisasi_kondisi_tanda_dan_id_unik():
    k = normalisasi_kondisi([{'label': 'Pertama', 'poin': 5}, {'label': 'Pertama', 'poin': 10}, {'label': ' '}], 'pelanggaran')
    assert k == [{'id': 'pertama', 'label': 'Pertama', 'poin': -5}, {'id': 'pertama-2', 'label': 'Pertama', 'poin': -10}]
    assert normalisasi_kondisi([], 'kebaikan', -7) == [{'id': 'umum', 'label': 'Setiap kejadian', 'poin': 7}]


def test_hitung_poin_aturan():
    aturan = {'poin': -5, 'kondisi': [{'id': 'pertama', 'label': 'Pertama', 'poin': -5}, {'id': 'ulang', 'label': 'Ulang', 'poin': -10}]}
    assert hitung_poin_aturan(aturan, 'ulang') == {'jenis_poin': 'pelanggaran', 'poin': -10, 'kondisi_id': 'ulang', 'kondisi': 'Ulang'}
    lama = {'poin': 15}  # aturan lama tanpa kondisi
    assert hitung_poin_aturan(lama)['poin'] == 15 and kondisi_aturan(lama)[0]['id'] == 'umum'
    for salah in (None, 'tidak-ada'):
        try:
            hitung_poin_aturan(aturan, salah)
            assert False, 'harus gagal'
        except ValueError:
            pass


def test_migrasi_aturan_kondisi():
    aturan = _Koleksi([{'_id': 1, 'poin': -5}, {'_id': 2, 'poin': 10, 'jenis_poin': 'kebaikan', 'kondisi': [{'id': 'x', 'label': 'X', 'poin': 10}]}])
    catatan = _Koleksi([{'_id': 9, 'tatib_poin': -5}])
    db = _Db(tatib_aturan=aturan, tatib_penanganan=catatan)
    hasil = asyncio.run(migrate_aturan(db))
    assert hasil == {'aturan_dilengkapi': 1, 'catatan_kondisi_id': 1}
    assert aturan.docs[0]['jenis_poin'] == 'pelanggaran'
    assert aturan.docs[0]['kondisi'] == [{'id': 'umum', 'label': 'Setiap kejadian', 'poin': -5}]
    assert aturan.docs[1]['kondisi'][0]['id'] == 'x'
    assert catatan.docs[0]['kondisi_id'] == 'umum'
    assert asyncio.run(migrate_aturan(db)) == {'aturan_dilengkapi': 0, 'catatan_kondisi_id': 0}
