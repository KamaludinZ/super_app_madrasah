# Update Menu Sidebar dan Avatar untuk Role Kelas & Siswa

**Date**: 2026-09-08
**Update**: Menu sidebar untuk role 'kelas' dan 'siswa', serta menu avatar untuk role 'kelas'

## Changes Made

### 1. Menu Sidebar untuk Role 'kelas' (NEW)

Role 'kelas' sebelumnya tidak memiliki menu sidebar. Sekarang ditambahkan menu:

```javascript
} else if (role === 'kelas') {
  items.push({ to: '/wali-kelas/siswa', label: 'Data Siswa', icon: Users, testid: 'nav-kelas-siswa' });
  items.push({ to: '/kelas-digital/materi', label: 'Materi Mapel', icon: BookOpen, testid: 'nav-kelas-materi' });
  items.push({ to: '/kelas-digital/tugas', label: 'Tugas', icon: ClipboardList, testid: 'nav-kelas-tugas' });
  items.push({ to: '/wali-kelas/jurnal-kelas', label: 'Riwayat Jurnal Kelas', icon: History, testid: 'nav-kelas-jurnal' });
  items.push({ to: '/wali-kelas/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-kelas-kehadiran' });
}
```

**Menu yang ditampilkan:**
1. 📊 **Dashboard** (default)
2. 👥 **Data Siswa** - `/wali-kelas/siswa`
3. 📚 **Materi Mapel** - `/kelas-digital/materi`
4. 📝 **Tugas** - `/kelas-digital/tugas`
5. 📖 **Riwayat Jurnal Kelas** - `/wali-kelas/jurnal-kelas`
6. ✅ **Kehadiran Siswa** - `/wali-kelas/kehadiran`

### 2. Menu Sidebar untuk Role 'siswa' (UPDATED)

Role 'siswa' sebelumnya hanya memiliki menu dasar. Sekarang ditambahkan menu kelas digital:

**BEFORE:**
```javascript
} else if (role === 'siswa') {
  items.push({ to: '/profile/siswa', label: 'Profil Saya', icon: UserCircle });
  items.push({ to: '/jadwal', label: 'Jadwal Saya', icon: Calendar });
  items.push({ to: '/siswa/kehadiran', label: 'Kehadiran Saya', icon: UserCheck });
  items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy });
  items.push({ to: '/ekstrakurikuler', label: 'Ekstrakurikuler', icon: Sparkles });
  items.push({ to: '/rapor', label: 'Rapor Saya', icon: FileText });
  items.push({ to: '/verval/ajuan-saya', label: 'Ajuan Verval Saya', icon: CheckCircle2 });
}
```

**AFTER:**
```javascript
} else if (role === 'siswa') {
  items.push({ to: '/profile/siswa', label: 'Profil Saya', icon: UserCircle });
  items.push({ to: '/wali-kelas/siswa', label: 'Data Siswa', icon: Users });  // ✅ NEW
  items.push({ to: '/jadwal', label: 'Jadwal Saya', icon: Calendar });
  items.push({ to: '/kelas-digital/materi', label: 'Materi Mapel', icon: BookOpen });  // ✅ NEW
  items.push({ to: '/kelas-digital/tugas', label: 'Tugas', icon: ClipboardList });  // ✅ NEW
  items.push({ to: '/wali-kelas/jurnal-kelas', label: 'Riwayat Jurnal Kelas', icon: History });  // ✅ NEW
  items.push({ to: '/siswa/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck });  // ✅ LABEL UPDATED
  items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy });
  items.push({ to: '/ekstrakurikuler', label: 'Ekstrakurikuler', icon: Sparkles });
  items.push({ to: '/rapor', label: 'Rapor Saya', icon: FileText });
  items.push({ to: '/verval/ajuan-saya', label: 'Ajuan Verval Saya', icon: CheckCircle2 });
}
```

**Menu baru yang ditambahkan:**
1. 👥 **Data Siswa** - `/wali-kelas/siswa` (NEW)
2. 📚 **Materi Mapel** - `/kelas-digital/materi` (NEW)
3. 📝 **Tugas** - `/kelas-digital/tugas` (NEW)
4. 📖 **Riwayat Jurnal Kelas** - `/wali-kelas/jurnal-kelas` (NEW)
5. ✅ **Kehadiran Siswa** - label diubah dari "Kehadiran Saya" (UPDATED)

### 3. Menu Avatar untuk Role 'kelas' (UPDATED)

Menu dropdown di avatar untuk role 'kelas' sekarang menyembunyikan "Profil Saya" dan "Ubah Password":

**BEFORE:**
```javascript
<DropdownMenuItem onClick={() => nav('/profile')}>
  <UserCircle className="h-4 w-4 mr-2" /> Profil Saya
</DropdownMenuItem>
<DropdownMenuItem onClick={() => { setPwDialogOpen(true); }}>
  <ShieldCheck className="h-4 w-4 mr-2" /> Ubah Password
</DropdownMenuItem>
```

**AFTER:**
```javascript
{/* Hide Profile and Change Password for 'kelas' role */}
{activeRole !== 'kelas' && (
  <>
    <DropdownMenuItem onClick={() => nav('/profile')}>
      <UserCircle className="h-4 w-4 mr-2" /> Profil Saya
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => { setPwDialogOpen(true); }}>
      <ShieldCheck className="h-4 w-4 mr-2" /> Ubah Password
    </DropdownMenuItem>
  </>
)}
```

**Menu yang ditampilkan untuk role 'kelas':**
- ❌ Profil Saya (HIDDEN)
- ❌ Ubah Password (HIDDEN)
- ✅ Panduan Pengguna (mobile only)
- ✅ Keluar

**Reasoning:**
- Role 'kelas' adalah akun kolektif (bukan personal account)
- Tidak memerlukan profil personal
- Tidak memerlukan ubah password (password dikelola oleh admin/wali kelas)
- Token kelas sudah mencakup autentikasi yang diperlukan

## File Modified

**File**: `frontend/src/components/layout/AppShell.js`

**Changes:**
1. Lines 97-115: Added role 'siswa' menu updates + new role 'kelas' menu
2. Lines 667-677: Added conditional rendering for profile/password menu items

## Menu Routes Reference

### Routes yang digunakan:

| Route | Description | Accessible by |
|-------|-------------|---------------|
| `/dashboard` | Dashboard utama | All roles |
| `/wali-kelas/siswa` | Data siswa kelas | siswa, kelas, wali_kelas |
| `/kelas-digital/materi` | Materi pelajaran | siswa, kelas |
| `/kelas-digital/tugas` | Tugas kelas | siswa, kelas |
| `/wali-kelas/jurnal-kelas` | Riwayat jurnal mengajar | siswa, kelas, wali_kelas |
| `/wali-kelas/kehadiran` | Kehadiran siswa kelas | kelas, wali_kelas |
| `/siswa/kehadiran` | Kehadiran siswa (view siswa) | siswa |

## User Experience

### Role 'kelas' - Sidebar Menu
```
📊 Dashboard
👥 Data Siswa
📚 Materi Mapel
📝 Tugas
📖 Riwayat Jurnal Kelas
✅ Kehadiran Siswa
```

### Role 'kelas' - Avatar Dropdown
```
[Avatar Icon]
├─ Panduan Pengguna (mobile only)
└─ Keluar
```

### Role 'siswa' - Sidebar Menu
```
📊 Dashboard
👤 Profil Saya
👥 Data Siswa  ⬅️ NEW
📅 Jadwal Saya
📚 Materi Mapel  ⬅️ NEW
📝 Tugas  ⬅️ NEW
📖 Riwayat Jurnal Kelas  ⬅️ NEW
✅ Kehadiran Siswa  ⬅️ UPDATED LABEL
🏆 Data Prestasi
✨ Ekstrakurikuler
📄 Rapor Saya
✔️ Ajuan Verval Saya
```

### Role 'siswa' - Avatar Dropdown (unchanged)
```
[Avatar Icon]
├─ Profil Saya
├─ Ubah Password
├─ Panduan Pengguna (mobile only)
└─ Keluar
```

## Backend Routes Required

Pastikan endpoint berikut sudah support role 'kelas' dan 'siswa':

- ✅ `/wali-kelas/siswa` - Data siswa (should filter by class)
- ✅ `/kelas-digital/materi` - Materi mapel (should filter by class)
- ✅ `/kelas-digital/tugas` - Tugas (should filter by class)
- ✅ `/wali-kelas/jurnal-kelas` - Riwayat jurnal (should filter by class)
- ✅ `/wali-kelas/kehadiran` - Kehadiran (should filter by class)

## Testing Checklist

### Role 'kelas':
- [ ] Login dengan akun kelas di `/kelas-login`
- [ ] Sidebar menampilkan 5 menu + dashboard
- [ ] Menu "Data Siswa" berfungsi
- [ ] Menu "Materi Mapel" berfungsi
- [ ] Menu "Tugas" berfungsi
- [ ] Menu "Riwayat Jurnal Kelas" berfungsi
- [ ] Menu "Kehadiran Siswa" berfungsi
- [ ] Avatar dropdown TIDAK menampilkan "Profil Saya"
- [ ] Avatar dropdown TIDAK menampilkan "Ubah Password"
- [ ] Avatar dropdown menampilkan "Keluar"

### Role 'siswa':
- [ ] Login dengan akun siswa di `/login`
- [ ] Sidebar menampilkan 11 menu + dashboard
- [ ] Menu baru "Data Siswa" muncul
- [ ] Menu baru "Materi Mapel" muncul
- [ ] Menu baru "Tugas" muncul
- [ ] Menu baru "Riwayat Jurnal Kelas" muncul
- [ ] Menu "Kehadiran Siswa" label sudah berubah
- [ ] Avatar dropdown TETAP menampilkan "Profil Saya"
- [ ] Avatar dropdown TETAP menampilkan "Ubah Password"

## Security Considerations

1. **Access Control**: Backend harus validate role sebelum melayani data
2. **Data Filtering**:
   - Role 'kelas' hanya bisa akses data kelasnya sendiri
   - Role 'siswa' hanya bisa akses data kelasnya sendiri
3. **Token Validation**:
   - Role 'kelas' menggunakan class token (bukan user token)
   - Backend `get_current_user()` sudah support role 'kelas' (see KELAS_AUTH_FIX.md)

## Notes

- Menu "Data Siswa" menggunakan route `/wali-kelas/siswa` yang sama dengan wali kelas
- Backend perlu filter data berdasarkan `class_id` dari token
- Role 'kelas' tidak punya profil personal karena merupakan akun kolektif
- Menu sidebar untuk role 'siswa' diperkaya dengan akses kelas digital

---

**Result**:
- ✅ Role 'kelas' sekarang memiliki menu sidebar lengkap
- ✅ Role 'siswa' mendapat tambahan menu kelas digital
- ✅ Menu avatar untuk role 'kelas' disederhanakan (tanpa profil & password)
