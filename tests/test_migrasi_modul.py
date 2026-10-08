"""Semua migrasi otomatis yang terdaftar dapat di-import (mencegah migrasi gagal karena galat sintaks)."""

import importlib
import inspect
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import migrasi_otomatis  # noqa: E402


def test_modul_migrasi_terdaftar_bisa_diimport():
    nama_modul = set()
    for _nama, fungsi in migrasi_otomatis.MIGRASI:
        nama_modul.update(re.findall(r'from (migrations\.\w+) import', inspect.getsource(fungsi)))
    assert nama_modul, 'tidak ada modul migrasi terdeteksi'
    for modul in sorted(nama_modul):
        assert callable(importlib.import_module(modul).migrate), modul
