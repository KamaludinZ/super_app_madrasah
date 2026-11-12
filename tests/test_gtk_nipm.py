"""NIPM (NIP buatan madrasah untuk GTK Non ASN): tersimpan lewat PUT /users, ikut berkas Excel Data GTK, dan susunan
kolom Excel GTK backend identik dengan frontend (frontend/src/lib/dataGtkKolom.js)."""

import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.join(ROOT, 'backend'))

from data_master_excel import KOLOM_DATA_GTK  # noqa: E402
from models import UserUpdateRequest  # noqa: E402


def test_nipm_diterima_saat_simpan_gtk():
    data = UserUpdateRequest(nipm='NIPM-2024-07', peg_id='PEG-9').model_dump(exclude_unset=True)
    assert data == {'nipm': 'NIPM-2024-07', 'peg_id': 'PEG-9'}


def test_nipm_di_kolom_excel_penugasan():
    kol = {k['key']: k for k in KOLOM_DATA_GTK}
    assert kol['nipm']['grup'] == 'Penugasan' and kol['nipm']['path'] == 'user.nipm'
    assert kol['peg_id']['grup'] == 'Kepegawaian'


def test_kolom_excel_gtk_sama_dengan_frontend():
    with open(os.path.join(ROOT, 'frontend', 'src', 'lib', 'dataGtkKolom.js'), encoding='utf-8') as f:
        js = f.read()
    blok = js[js.index('export const KOLOM_DATA_GTK'):js.index('];', js.index('export const KOLOM_DATA_GTK'))]
    # Urutan kemunculan ['key', 'Label' ...] dan { key: 'jenis', label: '...' } di file frontend.
    pola = re.compile(r"\[\s*'([a-z0-9_]+)',\s*'([^']+)'|key:\s*'([a-z0-9_]+)',\s*label:\s*'([^']+)'")
    frontend = [(m.group(1) or m.group(3), m.group(2) or m.group(4)) for m in pola.finditer(blok)]
    assert frontend == [(k['key'], k['label']) for k in KOLOM_DATA_GTK]
