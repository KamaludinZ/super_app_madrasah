"""Basis data tiruan (dalam memori) untuk uji modul PKG: subset operasi Motor yang dipakai service PKG."""

import asyncio


class Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, _n):
        return [dict(d) for d in self.docs]


def cocok_nilai(nilai, syarat):
    if isinstance(syarat, dict):
        for op, arg in syarat.items():
            if op == '$in' and nilai not in arg:
                return False
            if op == '$ne' and nilai == arg:
                return False
            if op == '$exists' and (nilai is not None) != arg:
                return False
        return True
    if isinstance(nilai, list):  # field array cocok bila memuat nilai (seperti MongoDB)
        return syarat in nilai
    return nilai == syarat


class Hasil:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class Koleksi:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]

    def _cocok(self, d, q):
        return all(cocok_nilai(d.get(k), v) for k, v in (q or {}).items())

    def find(self, q=None, _proj=None):
        return Cursor([d for d in self.docs if self._cocok(d, q)])

    async def find_one(self, q=None, _proj=None):
        return next((dict(d) for d in self.docs if self._cocok(d, q)), None)

    async def count_documents(self, q=None):
        return sum(1 for d in self.docs if self._cocok(d, q))

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    @staticmethod
    def _terapkan(d, u):
        d.update(u.get('$set', {}))
        for k, v in u.get('$inc', {}).items():
            d[k] = d.get(k, 0) + v
        for k in u.get('$unset', {}):
            d.pop(k, None)

    async def update_one(self, q, u, upsert=False):
        d = next((d for d in self.docs if self._cocok(d, q)), None)
        if d is None:
            if not upsert:
                return Hasil(matched_count=0, modified_count=0)
            d = {k: v for k, v in q.items() if not isinstance(v, dict)}
            d.update(u.get('$setOnInsert', {}))
            self.docs.append(d)
        self._terapkan(d, u)
        return Hasil(matched_count=1, modified_count=1)

    async def update_many(self, q, u):
        n = 0
        for d in self.docs:
            if self._cocok(d, q):
                self._terapkan(d, u)
                n += 1
        return Hasil(matched_count=n, modified_count=n)

    async def delete_one(self, q):
        sebelum = len(self.docs)
        for i, d in enumerate(self.docs):
            if self._cocok(d, q):
                del self.docs[i]
                break
        return Hasil(deleted_count=sebelum - len(self.docs))

    async def delete_many(self, q):
        sebelum = len(self.docs)
        self.docs = [d for d in self.docs if not self._cocok(d, q)]
        return Hasil(deleted_count=sebelum - len(self.docs))


class Db(dict):
    def __getattr__(self, nama):
        return self[nama]

    def __getitem__(self, nama):
        return self.setdefault(nama, Koleksi())


class Request:
    def __init__(self, jalur='/pkg/uji'):
        self.url = type('U', (), {'path': jalur})()
        self.client = type('C', (), {'host': '10.0.0.1'})()


def jalankan(coro):
    return asyncio.run(coro)
