# Perbaikan Fitur Pengumuman - Summary

## Masalah
Pengumuman yang dibuat di `/admin/pengumuman` tidak muncul di dashboard meskipun sudah ditandai sebagai aktif dan memiliki target role yang dipilih.

## Root Cause
Ada 2 masalah utama:

### 1. Query MongoDB Tidak Mencakup `is_active=None`
**Masalah:** Query backend hanya mencari `{'is_active': True}`, sehingga pengumuman dengan `is_active=None` atau `is_active` yang tidak ada tidak akan muncul.

**Solusi:** Mengubah query di 4 endpoint untuk mencakup dokumen dengan `is_active=None` atau field yang tidak ada:

```python
# Sebelumnya:
{'is_active': True}

# Setelah diperbaiki:
{'$or': [
    {'is_active': True},
    {'is_active': None},
    {'is_active': {'$exists': False}}
]}
```

**File yang diubah:** `backend/routers/notifications.py`
- Line 122: `/announcements` endpoint
- Line 154: `/notifications` endpoint
- Line 206: `/notifications/unread-count` endpoint
- Line 242: `/notifications/mark-all-read` endpoint

### 2. Admin Tidak Bisa Melihat Semua Pengumuman
**Masalah:** Fungsi `_user_matches_roles()` melakukan filtering berdasarkan role. Admin dengan role `['admin']` tidak bisa melihat pengumuman yang ditargetkan untuk `['siswa', 'guru', 'wali_kelas']`.

**Solusi:** Mengubah fungsi `_user_matches_roles()` agar admin selalu bisa melihat semua pengumuman:

```python
def _user_matches_roles(user: Dict, target_roles: List[str]) -> bool:
    # Admin users can see all announcements
    user_roles = set(user.get('roles', []))
    if 'admin' in user_roles:
        return True
    if not target_roles or 'all' in target_roles:
        return True
    return bool(user_roles & set(target_roles))
```

**File yang diubah:** `backend/routers/notifications.py` line 46-53

## Hasil
- Admin sekarang dapat melihat SEMUA pengumuman terlepas dari `target_roles` yang dipilih
- Pengumuman dengan `is_active=None` sekarang muncul di feed
- User lain (guru, siswa, wali_kelas) tetap hanya melihat pengumuman yang sesuai dengan role mereka
- Fungsi filtering role tetap bekerja dengan benar untuk non-admin users

## Testing
Verifikasi dilakukan dengan:
1. `check_announcements.py` - Memeriksa data pengumuman di database
2. `test_announcements_endpoint.py` - Testing logic filtering lengkap
3. `verify_admin_announcements.py` - Verifikasi admin bisa melihat semua pengumuman

Test result:
```
Admin user: admin
Roles: ['admin']
Announcement: Libur Semester Ganjil
- target_roles: ['siswa', 'guru', 'wali_kelas']
- Admin can see: True ✓

RESULT: Admin can see 1 out of 1 announcements ✓
```

## Files Modified
- `backend/routers/notifications.py` (lines 46-53, 122, 154, 206, 242)
