"""Peran satpam: terdaftar sebagai peran akun, bukan GTK, dan tidak memakai Simpan Akun."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

from core import PERAN_GTK, PERAN_SATPAM, jenis_gtk_peran  # noqa: E402
from models import ROLE_LABELS, ROLES  # noqa: E402
from routers import simpan_akun as api_simpan_akun  # noqa: E402


def test_satpam_terdaftar_dengan_label():
    assert PERAN_SATPAM == 'satpam'
    assert 'satpam' in ROLES
    assert ROLE_LABELS['satpam'] == 'Satpam'


def test_satpam_bukan_gtk():
    assert 'satpam' not in PERAN_GTK
    assert jenis_gtk_peran(['satpam']) is None
    # Merangkap peran GTK tetap mengikuti peran GTK-nya.
    assert jenis_gtk_peran(['satpam', 'tenaga_kependidikan']) == 'tendik'


def test_satpam_tanpa_simpan_akun():
    assert 'satpam' in api_simpan_akun.PERAN_NON_GTK
    assert not api_simpan_akun.adalah_gtk({'active_role': 'satpam', 'roles': ['satpam']})


def _daftar_js(path, nama):
    teks = (ROOT / path).read_text(encoding='utf-8')
    m = re.search(rf'{nama}\s*=\s*\[([^\]]*)\]', teks)
    assert m, f'{nama} tidak ditemukan di {path}'
    return set(re.findall(r"'([a-z_]+)'", m.group(1)))


def test_daftar_peran_web_sama_dengan_backend():
    """PERAN_NON_GTK & daftar GTK web harus sama dengan backend (satpam ikut tersinkron)."""
    assert _daftar_js('frontend/src/lib/menuUmum.js', 'PERAN_NON_GTK') == set(api_simpan_akun.PERAN_NON_GTK)
    js = 'frontend/src/lib/jenisGtk.js'
    gtk_web = _daftar_js(js, 'PERAN_GURU_GTK') | _daftar_js(js, 'PERAN_TENDIK_GTK')
    assert gtk_web == set(PERAN_GTK)
    gtk_hp = _daftar_js('mobile/src/utils/gtk.ts', 'PERAN_GURU_GTK') | _daftar_js('mobile/src/utils/gtk.ts', 'PERAN_TENDIK_GTK')
    assert gtk_hp == set(PERAN_GTK)


def test_gerbang_pin_brankas_menolak_satpam():
    """Endpoint PIN & isi brankas memakai wajib_gtk: satpam (bukan GTK) ditolak sebelum gerbang PIN."""
    import asyncio

    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as e:
        asyncio.run(api_simpan_akun.wajib_gtk({'id': 's', 'active_role': 'satpam', 'roles': ['satpam']}))
    assert e.value.status_code == 403
    rute_pin = [r for r in api_simpan_akun.router.routes if r.path.startswith('/simpan-akun/pin')]
    assert rute_pin
    for r in rute_pin:
        assert 'wajib_gtk' in [d.call.__name__ for d in r.dependant.dependencies], r.path


def test_peran_pengaju_izin_web_sama_dengan_backend():
    from izin_kamad import PERAN_PENGAJU_IZIN
    assert _daftar_js('frontend/src/lib/menuUmum.js', 'PERAN_PENGAJU_IZIN') == set(PERAN_PENGAJU_IZIN)


def test_satpam_bisa_dibuat_admin_tanpa_digabung_ke_master_gtk():
    """Opsi peran /roles memuat satpam; akun satpam bukan akun GTK (tidak dicocokkan ke data master GTK)."""
    import asyncio

    from routers import health, users

    assert {'value': 'satpam', 'label': 'Satpam'} in asyncio.run(health.get_roles())
    assert 'satpam' not in users.GTK_ACCOUNT_ROLES


# ---- Satpam dikecualikan dari data GTK: pasien UKS ----
def test_satpam_bukan_gtk_aturan():
    from core import satpam_bukan_gtk
    assert satpam_bukan_gtk(['satpam'])
    assert not satpam_bukan_gtk(['satpam', 'tenaga_kependidikan'])  # merangkap GTK tetap GTK
    assert not satpam_bukan_gtk(['guru']) and not satpam_bukan_gtk(['siswa']) and not satpam_bukan_gtk([])


class _CursorUks:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, _n):
        return list(self.docs)


class _KoleksiUks:
    def __init__(self, docs=()):
        self.docs = list(docs)

    async def find_one(self, q, _p=None):
        return next((dict(d) for d in self.docs if all(d.get(k) == v for k, v in q.items())), None)

    def find(self, q, _p=None):
        return _CursorUks([dict(d) for d in self.docs if all(d.get(k) == v for k, v in q.items())])


def test_pasien_uks_menolak_satpam(monkeypatch):
    import asyncio

    import pytest
    from fastapi import HTTPException

    from routers import uks

    from types import SimpleNamespace
    db = SimpleNamespace(users=_KoleksiUks([
        {'id': 'sp', 'roles': ['satpam'], 'full_name': 'Pak Satpam', 'nik': '3573000000000001'},
        {'id': 'gr', 'roles': ['guru'], 'full_name': 'Bu Guru', 'nik': '3573000000000002'},
    ]), student_details=_KoleksiUks())
    monkeypatch.setattr(uks, 'db', db)

    with pytest.raises(HTTPException) as e:
        asyncio.run(uks._get_pasien_or_404('sp'))
    assert e.value.status_code == 400 and 'Satpam' in e.value.detail
    assert asyncio.run(uks._get_pasien_or_404('gr'))['id'] == 'gr'

    # Impor CKG: lewat ID Pasien maupun NIK, satpam ditolak dengan pesan jelas.
    u, pesan, kolom = asyncio.run(uks._cari_pasien_impor_ckg({'pasien_id': 'sp'}))
    assert u is None and 'Satpam' in pesan and kolom == 'ID Pasien'
    u, pesan, kolom = asyncio.run(uks._cari_pasien_impor_ckg({'nik': '3573000000000001'}))
    assert u is None and 'Satpam' in pesan and kolom == 'NIK'
    u, pesan, _ = asyncio.run(uks._cari_pasien_impor_ckg({'nik': '3573000000000002'}))
    assert u['id'] == 'gr' and pesan is None


def test_daftar_gtk_backend_tanpa_satpam():
    """Data GTK, absensi GTK, E-Kinerja, impor GTK, mutasi: daftar peran tidak memuat satpam."""
    from data_master_impor import _query_target
    from data_master_service import GURU_ROLES, TENDIK_ROLES
    from routers import absensi_gtk, ekinerja
    from routers._shared import _GTK_ROLES

    for daftar in (GURU_ROLES, TENDIK_ROLES, _GTK_ROLES, absensi_gtk.GTK_ROLES, ekinerja.PENGUMPULAN_GTK_ROLES,
                   _query_target('gtk')['roles']['$in']):
        assert 'satpam' not in daftar


# ---- Impor Excel GTK mengabaikan satpam ----
class _BerkasUnggah:
    def __init__(self, nama, isi):
        self.filename = nama
        self._isi = isi

    async def read(self, *_a):
        return self._isi


def _xlsx(header, baris):
    import io

    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(header)
    for b in baris:
        ws.append(b)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


class _KoleksiImpor:
    def __init__(self, docs=()):
        self.docs = list(docs)
        self.disisipkan = []

    async def find_one(self, q, _p=None):
        def cocok(d):
            for k, v in q.items():
                if isinstance(v, dict) and '$in' in v:
                    if not set(d.get(k) or []) & set(v['$in']):
                        return False
                elif isinstance(v, dict) and '$regex' in v:
                    import re
                    if not re.match(v['$regex'], d.get(k) or '', re.I):
                        return False
                elif d.get(k) != v:
                    return False
            return True
        return next((dict(d) for d in self.docs if cocok(d)), None)

    async def insert_many(self, docs):
        self.disisipkan.extend(docs)

    async def update_one(self, *_a, **_k):
        raise AssertionError('akun satpam tidak boleh diubah oleh impor GTK')


def test_impor_excel_gtk_melewati_baris_satpam_dan_tidak_menyentuh_akun_satpam(monkeypatch):
    import asyncio
    from types import SimpleNamespace

    from routers import users

    # Akun satpam yang sudah ada dengan nama & NIP sama tidak boleh "diaktifkan" sebagai GTK.
    koll = _KoleksiImpor([{'id': 'sp', 'roles': ['satpam'], 'full_name': 'Budi Santoso', 'nip_nuptk': '1987',
                           'username': ''}])
    monkeypatch.setattr(users, 'db', SimpleNamespace(users=koll))
    berkas = _xlsx(['nama_lengkap', 'roles', 'nip_nuptk', 'email', 'phone', 'gender'], [
        ['Pak Satpam', 'satpam', '', '', '', 'L'],
        ['Budi Santoso', 'tenaga_kependidikan', '1987', '', '', 'L'],
    ])
    hasil = asyncio.run(users.users_gtk_initial_import(_BerkasUnggah('gtk.xlsx', berkas), None, {'id': 'admin'}))
    assert hasil['success'] == 1 and hasil['total_rows'] == 2
    assert hasil['errors'][0]['row'] == 2 and 'Satpam bukan GTK' in hasil['errors'][0]['error']
    # Baris tendik menjadi data GTK baru, bukan menimpa akun satpam.
    assert [d['roles'] for d in koll.disisipkan] == [['tenaga_kependidikan']]
    assert koll.docs[0]['roles'] == ['satpam']


def test_peran_pemutus_izin_web_sama_dengan_backend():
    from izin_kamad import PERAN_PEMUTUS_IZIN
    assert _daftar_js('frontend/src/lib/menuUmum.js', 'PERAN_PEMUTUS_IZIN') == set(PERAN_PEMUTUS_IZIN)


def test_peran_non_gtk_aplikasi_sama_dengan_web_dan_backend():
    """Menu PKG aplikasi tidak diminta untuk peran non-GTK (termasuk satpam), sama dengan web & backend."""
    assert _daftar_js('mobile/src/menu/pkg.ts', 'PERAN_NON_GTK') == set(api_simpan_akun.PERAN_NON_GTK)


def test_peran_pemantau_izin_termasuk_pembaca_papan_backend():
    from izin_kamad import PERAN_PAPAN_IZIN
    assert _daftar_js('frontend/src/lib/menuUmum.js', 'PERAN_PEMANTAU_IZIN') <= set(PERAN_PAPAN_IZIN)


def test_peran_pembaca_catatan_web_aplikasi_sama_dengan_backend():
    from izin_kamad import PERAN_PEMBACA_CATATAN
    assert _daftar_js('frontend/src/lib/izinKamad.js', 'PERAN_PEMBACA_CATATAN') == set(PERAN_PEMBACA_CATATAN)
    assert _daftar_js('mobile/src/izin/api.ts', 'PERAN_PEMBACA_CATATAN') == set(PERAN_PEMBACA_CATATAN)
    assert 'satpam' not in PERAN_PEMBACA_CATATAN


def test_hasil_ckg_saya_menolak_satpam():
    """Fitur Hasil CKG Saya (siswa & GTK) tidak berlaku untuk satpam yang bukan pasien UKS."""
    import asyncio

    import pytest
    from fastapi import HTTPException

    from routers import uks

    with pytest.raises(HTTPException) as e:
        asyncio.run(uks.get_ckg_saya(None, {'id': 's', 'active_role': 'satpam', 'roles': ['satpam']}))
    assert e.value.status_code == 403 and 'Satpam' in e.value.detail
