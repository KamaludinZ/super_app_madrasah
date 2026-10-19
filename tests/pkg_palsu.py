"""Basis data tiruan (dalam memori) untuk uji modul PKG: subset operasi Motor yang dipakai service PKG."""

import asyncio
import re


class Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, kunci, arah=1):
        urutan = kunci if isinstance(kunci, list) else [(kunci, arah)]
        for k, a in reversed(urutan):  # sort stabil: kunci terakhir dulu
            self.docs = sorted(self.docs, key=lambda d: (d.get(k) is not None, d.get(k) if d.get(k) is not None else ''),
                               reverse=a == -1)
        return self

    def skip(self, n):
        self.docs = self.docs[n:]
        return self

    def limit(self, n):
        self.docs = self.docs[:n] if n else self.docs
        return self

    async def to_list(self, _n):
        return [dict(d) for d in self.docs]


def cocok_nilai(nilai, syarat):
    if isinstance(syarat, dict):
        for op, arg in syarat.items():
            if op == '$in' and not (set(nilai) & set(arg) if isinstance(nilai, list) else nilai in arg):
                return False
            if op == '$ne' and nilai == arg:
                return False
            if op == '$exists' and (nilai is not None) != arg:
                return False
            if op in ('$gte', '$gt', '$lte', '$lt') and (nilai is None or not {
                    '$gte': nilai >= arg, '$gt': nilai > arg, '$lte': nilai <= arg, '$lt': nilai < arg}[op]):
                return False
            if op == '$regex' and not (isinstance(nilai, str) and re.search(
                    arg, nilai, re.IGNORECASE if 'i' in syarat.get('$options', '') else 0)):
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
        for k, v in (q or {}).items():
            if k == '$or':
                if not any(self._cocok(d, sub) for sub in v):
                    return False
            elif not cocok_nilai(d.get(k), v):
                return False
        return True

    def find(self, q=None, _proj=None):
        return Cursor([d for d in self.docs if self._cocok(d, q)])

    async def find_one(self, q=None, _proj=None):
        return next((dict(d) for d in self.docs if self._cocok(d, q)), None)

    async def count_documents(self, q=None):
        return sum(1 for d in self.docs if self._cocok(d, q))

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def create_index(self, keys, **kwargs):
        self.__dict__.setdefault('index', []).append((keys, kwargs))
        return kwargs.get('name')

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
