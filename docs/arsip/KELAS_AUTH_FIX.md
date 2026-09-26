# Kelas Authentication Fix - Logout Issue Resolved

**Date**: 2026-09-08
**Issue**: User berhasil login di `/kelas-login` tapi langsung logout dan redirect ke `/login`

## Root Cause Analysis

### Problem
Setelah login sukses dengan role 'kelas', user langsung di-logout dan di-redirect kembali ke `/login`.

### Investigation Steps

1. **Login Flow Works**:
   - `/kelas-digital/auth/login` endpoint ✅ berhasil
   - JWT token berhasil dibuat ✅
   - Token disimpan di localStorage ✅
   - Redirect ke `/dashboard` ✅

2. **Dashboard Load Fails**:
   - Frontend memanggil `/auth/me` untuk refresh user data
   - Backend mencari user di collection `users`
   - ❌ **FAIL**: Role 'kelas' data ada di collection `classes`, bukan `users`!
   - Backend return 401 Unauthorized
   - Frontend melihat 401 → logout otomatis
   - Redirect ke `/login`

### Technical Details

**JWT Payload untuk role 'kelas':**
```json
{
  "sub": "f5704b70-045b-46b5-8e11-92aeee1ff6e2",  // class_id (bukan user_id!)
  "active_role": "kelas",
  "exp": 1234567890
}
```

**Kode Lama (`core.py` line 161-163):**
```python
async def get_current_user(...):
    user_id = payload.get('sub')
    user = await db.users.find_one({'id': user_id})  # ❌ Cari di 'users' collection
    if not user or not user.get('is_active', True):
        raise HTTPException(status_code=401, ...)  # ❌ 401 karena tidak ketemu!
```

**Masalah:**
- `user_id` sebenarnya adalah `class_id` untuk role 'kelas'
- Lookup di `db.users` tidak akan menemukan class data
- HTTPException 401 → frontend logout

## Solution

Update `get_current_user()` di `backend/core.py` untuk mendukung role 'kelas':

### Code Changes

```python
async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi. Silakan login.")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa")

    active_role = payload.get('active_role')
    user_id = payload.get('sub')

    # ✅ NEW: Special handling for 'kelas' role
    if active_role == 'kelas':
        # For kelas, 'sub' contains class_id
        kelas = await db.classes.find_one({'id': user_id})
        if not kelas or not kelas.get('is_active', True):
            raise HTTPException(status_code=401, detail="Kelas tidak ditemukan atau dinonaktifkan")

        # Build a user-like object for kelas
        kelas['active_role'] = 'kelas'
        kelas['roles'] = ['kelas']
        return serialize_doc(kelas)

    # Regular user authentication (unchanged)
    user = await db.users.find_one({'id': user_id})
    if not user or not user.get('is_active', True):
        raise HTTPException(status_code=401, detail="User tidak ditemukan atau dinonaktifkan")
    user['active_role'] = payload.get('active_role',
                                      user['roles'][0] if user.get('roles') else 'guru')

    # ... rest of the code
    return serialize_doc(user)
```

### Key Changes

1. **Extract `active_role` from payload** sebelum melakukan lookup
2. **Check if role is 'kelas'**:
   - Jika ya → lookup di `db.classes`
   - Build user-like object dengan `active_role='kelas'` dan `roles=['kelas']`
   - Return class data sebagai user object
3. **Regular users**: tetap lookup di `db.users` seperti biasa

## Testing

### Before Fix
```
1. Login di /kelas-login dengan token valid
2. Redirect ke /dashboard
3. Frontend call /auth/me
4. Backend return 401 (class tidak ditemukan di users collection)
5. Frontend logout otomatis
6. Redirect ke /login ❌
```

### After Fix
```
1. Login di /kelas-login dengan token valid
2. Redirect ke /dashboard
3. Frontend call /auth/me
4. Backend detect active_role = 'kelas'
5. Backend lookup di db.classes
6. Backend return class data ✅
7. Dashboard KelasDashboard ditampilkan ✅
```

## Files Modified

- **`backend/core.py`**: Updated `get_current_user()` function (lines 151-193)

## Impact

### Before
- ❌ Role 'kelas' tidak bisa stay logged in
- ❌ Selalu di-redirect ke `/login` setelah login sukses
- ❌ `/auth/me` gagal untuk role 'kelas'

### After
- ✅ Role 'kelas' bisa login dan tetap logged in
- ✅ Dashboard kelas ditampilkan dengan benar
- ✅ `/auth/me` berhasil untuk role 'kelas'
- ✅ Semua endpoint yang use `Depends(get_current_user)` sekarang support role 'kelas'

## Security Considerations

- ✅ Class harus `is_active=True` untuk bisa login
- ✅ JWT validation tetap ketat
- ✅ Role validation via `active_role` in payload
- ✅ Class data tidak expose sensitive info (token sudah di-exclude di public endpoint)
- ✅ Impersonation tetap work untuk user roles

## Future Improvements

Jika ada role khusus lain yang menggunakan collection selain `users`:
1. Tambahkan condition di `get_current_user()`
2. Lookup ke collection yang sesuai
3. Build user-like object dengan role yang tepat

## Backward Compatibility

✅ **Fully backward compatible**
- Semua user roles existing tetap work (guru, siswa, admin, etc.)
- Hanya menambah support untuk role 'kelas'
- Tidak ada breaking changes

---

**Result**: Role 'kelas' sekarang bisa login dan mengakses dashboard dengan lancar tanpa logout otomatis! 🎉
