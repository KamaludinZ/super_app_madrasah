"""Login lewat tiket (SSO sederhana): Super App menjadi pusat login untuk aplikasi madrasah lain (Absensi, PTSP,
Koperasi, Perpustakaan, ...).

Alur:
1. Pengguna login ke Super App. Dashboard menampilkan aplikasi yang boleh ia buka (GET /sso/aplikasi-saya).
2. Klik aplikasi -> POST /sso/aplikasi/{id}/masuk: Super App membuat TIKET acak (berlaku UMUR_TIKET_DETIK, sekali
   pakai; yang disimpan hanya hash SHA-256-nya) dan mengembalikan URL penerima aplikasi tujuan `...?tiket=...`.
3. Aplikasi tujuan menukar tiket ke Super App dari servernya (server ke server):
   POST /sso/tukar  Authorization: Bearer <kunci rahasia aplikasi>  {"tiket": "..."}
   -> data pengguna (username, nama, email, NIP, NISN, Peg ID, peran, jenis). Tiket langsung hangus.
4. Aplikasi tujuan mencocokkan akun lokalnya (username / NIP / NISN / Peg ID / email) lalu membuat sesi login.

Hak akses per aplikasi diatur admin: daftar peran yang boleh, ditambah pengguna khusus yang diizinkan (walau
perannya tidak terdaftar) dan pengguna yang diblokir (walau perannya terdaftar). Hak akses diperiksa ulang saat
penukaran, jadi pencabutan akses berlaku seketika.

Kunci rahasia aplikasi hanya ditampilkan sekali saat dibuat/dibuat ulang; yang disimpan hash SHA-256-nya.
"""
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

KOLEKSI_APLIKASI = 'sso_aplikasi'
KOLEKSI_TIKET = 'sso_tiket'

UMUR_TIKET_DETIK = 60
# Dokumen tiket dihapus MongoDB (TTL) sekian detik setelah kedaluwarsa; jejaknya tetap ada di audit_logs.
SIMPAN_TIKET_DETIK = 3600
AWALAN_KUNCI = 'sso_'
POLA_ID_APLIKASI = r'^[a-z0-9][a-z0-9-]{1,39}$'
# Peran yang tidak bisa memakai SSO: akun kelas (layar kelas) bukan orang.
PERAN_TIDAK_SSO = ('kelas',)


def sekarang() -> datetime:
    return datetime.now(timezone.utc)


def hash_rahasia(nilai: str) -> str:
    return hashlib.sha256((nilai or '').encode('utf-8')).hexdigest()


def buat_kunci_rahasia() -> str:
    return AWALAN_KUNCI + secrets.token_urlsafe(32)


def buat_tiket() -> str:
    return secrets.token_urlsafe(32)


def url_dengan_tiket(url_masuk: str, tiket: str) -> str:
    return f"{url_masuk}{'&' if '?' in url_masuk else '?'}tiket={tiket}"


def _aware(nilai: Any) -> Optional[datetime]:
    """Datetime dari MongoDB (motor mengembalikan naive UTC) -> aware UTC."""
    if isinstance(nilai, datetime):
        return nilai if nilai.tzinfo else nilai.replace(tzinfo=timezone.utc)
    return None


# ---------------------------------------------------------------- hak akses

def boleh_akses(aplikasi: Optional[Dict[str, Any]], user: Optional[Dict[str, Any]]) -> bool:
    """Pengguna boleh membuka aplikasi: aplikasi aktif, akun aktif, tidak diblokir, dan (diizinkan khusus atau
    salah satu perannya terdaftar di aplikasi)."""
    if not aplikasi or not user or not aplikasi.get('aktif', True) or user.get('is_active') is False:
        return False
    roles = [r for r in (user.get('roles') or []) if r not in PERAN_TIDAK_SSO]
    if not roles:
        return False
    uid = user.get('id')
    if uid in (aplikasi.get('blokir_pengguna') or []):
        return False
    if uid in (aplikasi.get('izin_pengguna') or []):
        return True
    return bool(set(roles) & set(aplikasi.get('peran') or []))


# ---------------------------------------------------------------- data pengguna untuk aplikasi tujuan

def _isi(nilai: Any) -> Optional[str]:
    t = str(nilai or '').strip()
    return t or None


def jenis_pengguna(roles: List[str]) -> str:
    """'siswa' | 'guru' | 'pegawai' | 'alumni' — kelompok besar untuk aplikasi tujuan (mis. jenis anggota koperasi)."""
    from core import jenis_gtk_peran
    roles = roles or []
    if 'siswa' in roles:
        return 'siswa'
    gtk = jenis_gtk_peran(roles)
    if gtk == 'guru':
        return 'guru'
    if gtk == 'tendik':
        return 'pegawai'
    if roles and all(r == 'alumni' for r in roles):
        return 'alumni'
    return 'pegawai'


def profil_pengguna(user: Dict[str, Any], kelas: Optional[Dict[str, Any]] = None,
                    peran_aktif: Optional[str] = None) -> Dict[str, Any]:
    """Data pengguna yang dikirim ke aplikasi tujuan untuk mencocokkan akun lokal. Tidak pernah memuat password,
    token, atau data sensitif lain."""
    nip_nuptk = _isi(user.get('nip_nuptk'))
    angka = re.sub(r'\D', '', nip_nuptk or '')
    roles = [r for r in (user.get('roles') or []) if r not in PERAN_TIDAK_SSO]
    return {
        'id': user.get('id'),
        'username': _isi(user.get('username')),
        'nama': _isi(user.get('full_name')),
        'email': _isi(user.get('email')),
        # NIP ASN (field nip; field lama nip_nuptk bila berisi 18 digit), NUPTK (16 digit), Peg ID (non-ASN).
        'nip': _isi(user.get('nip')) or (nip_nuptk if len(angka) == 18 else None),
        'nuptk': _isi(user.get('nuptk')) or (nip_nuptk if len(angka) == 16 else None),
        'peg_id': _isi(user.get('peg_id')),
        'nisn': _isi(user.get('nisn')),
        'nis': _isi(user.get('nis')),
        'jenis_kelamin': _isi(user.get('gender')),
        'peran': roles,
        'peran_aktif': peran_aktif if peran_aktif in roles else (roles[0] if roles else None),
        'jenis': jenis_pengguna(roles),
        'kelas': _isi((kelas or {}).get('name')),
        'telepon': _isi(user.get('phone')),
    }


# ---------------------------------------------------------------- aplikasi

def aplikasi_tampil(app: Dict[str, Any], lengkap: bool = False) -> Dict[str, Any]:
    """Data aplikasi untuk frontend. `lengkap` (admin) menyertakan aturan akses & awalan kunci; hash kunci tidak
    pernah dikirim."""
    dasar = {k: app.get(k) for k in ('id', 'nama', 'deskripsi', 'url_ikon', 'urutan')}
    if not lengkap:
        return dasar
    return {
        **dasar,
        **{k: app.get(k) for k in ('url_masuk', 'aktif', 'kunci_awal', 'kunci_dibuat_pada', 'created_at', 'updated_at')},
        'peran': list(app.get('peran') or []),
        'izin_pengguna': list(app.get('izin_pengguna') or []),
        'blokir_pengguna': list(app.get('blokir_pengguna') or []),
    }


def data_kunci(kunci: str) -> Dict[str, Any]:
    return {'kunci_hash': hash_rahasia(kunci), 'kunci_awal': kunci[:12], 'kunci_dibuat_pada': sekarang().isoformat()}


async def aplikasi_milik(db, user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Aplikasi aktif yang boleh dibuka pengguna, urut `urutan` lalu nama."""
    semua = await db[KOLEKSI_APLIKASI].find({'aktif': True}, {'_id': 0, 'kunci_hash': 0}).to_list(200)
    boleh = [a for a in semua if boleh_akses(a, user)]
    boleh.sort(key=lambda a: (a.get('urutan') or 0, (a.get('nama') or '').lower()))
    return [aplikasi_tampil(a) for a in boleh]


# ---------------------------------------------------------------- tiket

class GalatSso(Exception):
    def __init__(self, status: int, kode: str, pesan: str):
        super().__init__(pesan)
        self.status, self.kode, self.pesan = status, kode, pesan


async def terbitkan_tiket(db, aplikasi_id: str, user: Dict[str, Any], ip: Optional[str] = None) -> Dict[str, Any]:
    """Tiket sekali pakai untuk membuka aplikasi. Hanya hash tiket yang disimpan."""
    app = await db[KOLEKSI_APLIKASI].find_one({'id': aplikasi_id}, {'_id': 0})
    if not app or not app.get('aktif', True):
        raise GalatSso(404, 'aplikasi_tidak_ada', 'Aplikasi tidak ditemukan atau sedang dinonaktifkan.')
    if user.get('is_impersonating'):
        raise GalatSso(403, 'sedang_menyamar', 'Tidak dapat membuka aplikasi lain saat masuk sebagai pengguna lain.')
    if not boleh_akses(app, user):
        raise GalatSso(403, 'tidak_berhak', 'Anda tidak memiliki akses ke aplikasi ini.')
    tiket = buat_tiket()
    t = sekarang()
    await db[KOLEKSI_TIKET].insert_one({
        'hash': hash_rahasia(tiket), 'aplikasi_id': app['id'], 'user_id': user.get('id'),
        'peran_aktif': user.get('active_role'), 'dibuat_pada': t, 'kedaluwarsa': t + timedelta(seconds=UMUR_TIKET_DETIK),
        'dipakai_pada': None, 'ip_pengguna': ip,
    })
    return {'url': url_dengan_tiket(app['url_masuk'], tiket), 'berlaku_detik': UMUR_TIKET_DETIK, 'aplikasi': aplikasi_tampil(app)}


async def aplikasi_dari_kunci(db, kunci: Optional[str]) -> Dict[str, Any]:
    if not kunci or not kunci.startswith(AWALAN_KUNCI):
        raise GalatSso(401, 'kunci_tidak_valid', 'Kunci aplikasi tidak valid.')
    app = await db[KOLEKSI_APLIKASI].find_one({'kunci_hash': hash_rahasia(kunci)}, {'_id': 0})
    if not app:
        raise GalatSso(401, 'kunci_tidak_valid', 'Kunci aplikasi tidak valid.')
    if not app.get('aktif', True):
        raise GalatSso(403, 'aplikasi_nonaktif', 'Aplikasi sedang dinonaktifkan di Super App.')
    return app


async def tukar_tiket(db, kunci: Optional[str], tiket: Optional[str], ip: Optional[str] = None) -> Dict[str, Any]:
    """Penukaran tiket oleh server aplikasi tujuan: tiket valid, milik aplikasi ini, belum kedaluwarsa & belum
    dipakai -> ditandai terpakai (atomik) lalu data pengguna dikembalikan. Hak akses diperiksa ulang."""
    app = await aplikasi_dari_kunci(db, kunci)
    if not tiket or len(tiket) > 200:
        raise GalatSso(400, 'tiket_tidak_valid', 'Tiket tidak valid.')
    h = hash_rahasia(tiket)
    doc = await db[KOLEKSI_TIKET].find_one({'hash': h}, {'_id': 0})
    if not doc or doc.get('aplikasi_id') != app['id']:
        raise GalatSso(400, 'tiket_tidak_valid', 'Tiket tidak valid.')
    if doc.get('dipakai_pada'):
        raise GalatSso(400, 'tiket_sudah_dipakai', 'Tiket sudah pernah dipakai. Buka lagi aplikasi dari Super App.')
    t = sekarang()
    exp = _aware(doc.get('kedaluwarsa'))
    if not exp or exp <= t:
        raise GalatSso(400, 'tiket_kedaluwarsa', 'Tiket sudah kedaluwarsa. Buka lagi aplikasi dari Super App.')
    # Atomik: hanya satu penukaran yang berhasil walau tiket dikirim bersamaan.
    hasil = await db[KOLEKSI_TIKET].update_one({'hash': h, 'aplikasi_id': app['id'], 'dipakai_pada': None},
                                               {'$set': {'dipakai_pada': t, 'ip_aplikasi': ip}})
    if getattr(hasil, 'modified_count', 1) == 0:
        raise GalatSso(400, 'tiket_sudah_dipakai', 'Tiket sudah pernah dipakai. Buka lagi aplikasi dari Super App.')
    user = await db.users.find_one({'id': doc.get('user_id')}, {'_id': 0, 'password_hash': 0, 'password': 0})
    if not user or user.get('is_active') is False:
        raise GalatSso(403, 'pengguna_nonaktif', 'Akun pengguna tidak ditemukan atau dinonaktifkan.')
    if not boleh_akses(app, user):
        raise GalatSso(403, 'tidak_berhak', 'Pengguna tidak lagi memiliki akses ke aplikasi ini.')
    kelas = None
    if 'siswa' in (user.get('roles') or []) and user.get('student_class_id'):
        kelas = await db.classes.find_one({'id': user['student_class_id']}, {'_id': 0, 'name': 1})
    return {
        'aplikasi': app['id'],
        'pengguna': profil_pengguna(user, kelas, doc.get('peran_aktif')),
        'masuk_pada': _aware(doc.get('dibuat_pada')).isoformat() if _aware(doc.get('dibuat_pada')) else None,
    }


async def ensure_sso_indexes(database) -> List[str]:
    specs = [
        (KOLEKSI_APLIKASI, 'id', {'unique': True}),
        (KOLEKSI_APLIKASI, 'kunci_hash', {'unique': True, 'sparse': True}),
        (KOLEKSI_TIKET, 'hash', {'unique': True}),
        (KOLEKSI_TIKET, 'kedaluwarsa', {'expireAfterSeconds': SIMPAN_TIKET_DETIK}),
    ]
    gagal = []
    for coll, keys, kwargs in specs:
        try:
            await database[coll].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001 - dilaporkan ke pemanggil
            gagal.append(f'{coll} {keys}: {e}')
    return gagal
