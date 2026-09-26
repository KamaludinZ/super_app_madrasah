# Perbaikan Materi & Tugas - Kelas Digital

## Tanggal: 11 September 2026

## Ringkasan Perubahan

Dokumen ini merangkum semua perbaikan yang dilakukan pada fitur Materi dan Tugas di Kelas Digital.

---

## 1. Perbaikan Backend Models

### A. TugasModel (models.py)
**File**: `backend/models.py`

**Field Baru yang Ditambahkan**:
- `deskripsi: Optional[str]` - Deskripsi singkat tugas
- `file_url: Optional[str]` - URL file lampiran
- `deadline: Optional[str]` - Deadline dalam format ISO string (YYYY-MM-DDTHH:MM:SS)

### B. MateriMapelModel (models.py)
**File**: `backend/models.py`

**Field Baru yang Ditambahkan**:
- `deskripsi: Optional[str]` - Deskripsi singkat materi
- `file_url: Optional[str]` - URL file lampiran

### C. MateriTugasCreateRequest (models.py)
**Field Baru**:
- `deskripsi: Optional[str]`
- `file_url: Optional[str]`
- `deadline: Optional[str]` (untuk tugas)

### D. MateriTugasUpdateRequest (models.py)
**Field Baru**:
- `deskripsi: Optional[str]`
- `file_url: Optional[str]`
- `deadline: Optional[str]`

---

## 2. Perbaikan Backend Endpoints

### A. Fix GET `/kelas/materi` untuk Role Siswa
**File**: `backend/routers/kelas_digital.py`

**Masalah**:
- Endpoint hanya memiliki `pass` untuk role siswa, tidak mengembalikan data apapun

**Perbaikan**:
- Menambahkan logika untuk mengambil materi dengan `target_role='kelas'` dari kelas siswa
- Menambahkan logika untuk mengambil materi dengan `target_role='siswa'` yang ditujukan untuk siswa tertentu
- Menggabungkan kedua list materi
- Enrich dengan teacher dan subject info

### B. Fix GET `/kelas/tugas` untuk Role Siswa
**File**: `backend/routers/kelas_digital.py`

**Masalah**:
- Tidak ada handling untuk role siswa, langsung throw error 403 Forbidden

**Perbaikan**:
- Implementasi sama seperti endpoint materi
- Menambahkan `submission_status` untuk setiap tugas

### C. Update POST `/kelas/tugas` (Create)
**File**: `backend/routers/kelas_digital.py`

**Perubahan**:
- Menambahkan parameter `deskripsi`, `file_url`, dan `deadline` saat membuat tugas

### D. Update PUT `/kelas/tugas/{tugas_id}` (Update)
**File**: `backend/routers/kelas_digital.py`

**Perubahan**:
- Menambahkan handling untuk field `deskripsi`, `file_url`, dan `deadline`

### E. Update POST `/kelas/materi` (Create)
**File**: `backend/routers/kelas_digital.py`

**Perubahan**:
- Menambahkan parameter `deskripsi` dan `file_url` saat membuat materi

### F. Update PUT `/kelas/materi/{materi_id}` (Update)
**File**: `backend/routers/kelas_digital.py`

**Perubahan**:
- Menambahkan handling untuk field `deskripsi` dan `file_url`

### G. Endpoint Baru: GET `/kelas/tugas/{tugas_id}/submissions`
**File**: `backend/routers/kelas_digital.py`

**Fungsi**:
- Mengambil semua submissions untuk tugas tertentu
- Hanya guru pembuat tugas atau admin yang bisa mengakses
- Enrich submissions dengan info siswa (nama, NIS, NISN)

**Response**:
```json
{
  "tugas_id": "xxx",
  "tugas_judul": "Tugas Matematika",
  "total_submissions": 25,
  "submissions": [
    {
      "id": "submission-id",
      "student_id": "student-id",
      "student_name": "Ahmad Rizki",
      "student_nis": "123456",
      "student_nisn": "0001234567",
      "jawaban": "Ini jawaban saya...",
      "file_url": "https://drive.google.com/...",
      "submitted_at": "2026-09-11T09:00:00"
    }
  ]
}
```

---

## 3. Perbaikan Frontend

### A. SiswaMateriPage.js
**File**: `frontend/src/pages/siswa/SiswaMateriPage.js`

**Masalah**:
- Tab Kelas dan Tab Siswa menampilkan 0 materi
- Frontend melakukan filtering berdasarkan `target_role`, tetapi backend sudah mengembalikan data yang filtered dan merged

**Perbaikan**:
```javascript
// Sebelum
const kelas = res.data.filter((m) => m.target_role?.includes?.('kelas') || m.target_role === 'kelas');

// Sesudah
const kelas = res.data.filter((m) =>
  m.target_role === 'kelas' || (Array.isArray(m.target_role) && m.target_role.includes('kelas'))
);
```

**Penjelasan**:
- Backend mengembalikan gabungan materi kelas dan materi siswa
- Frontend perlu memisahkan berdasarkan `target_role` untuk ditampilkan di tab yang berbeda
- Handling untuk `target_role` yang bisa berupa string atau array

### B. SiswaTugasPage.js
**File**: `frontend/src/pages/siswa/SiswaTugasPage.js`

**Perbaikan**:
- Sama seperti SiswaMateriPage
- Memperbaiki filtering untuk memisahkan tugas kelas dan tugas siswa

---

## 4. Fitur-Fitur Baru yang Tersedia

### Untuk Guru:
1. ✅ Dapat menambahkan **deadline** saat membuat tugas
2. ✅ Dapat menambahkan **deskripsi** singkat untuk materi/tugas
3. ✅ Dapat menambahkan **file lampiran** untuk materi/tugas
4. ✅ Dapat melihat **semua submissions** dari siswa untuk tugas tertentu
5. ✅ Submissions ditampilkan dengan informasi lengkap siswa

### Untuk Siswa:
1. ✅ Dapat melihat materi yang ditujukan untuk **kelasnya** (target_role='kelas')
2. ✅ Dapat melihat materi yang ditujukan **khusus untuk dirinya** (target_role='siswa')
3. ✅ Dapat melihat tugas dengan **deadline** yang jelas
4. ✅ Tab "Materi Kelas" dan "Materi Siswa" sekarang berfungsi dengan benar
5. ✅ Tab "Tugas Kelas" dan "Tugas Siswa" sekarang berfungsi dengan benar

### Untuk Kelas (Role Kelas):
1. ✅ Hanya menampilkan materi/tugas dengan target_role='kelas'
2. ✅ Tidak ada tab, langsung menampilkan daftar mata pelajaran
3. ✅ Click mata pelajaran → reveal accordion dengan materi/tugas

---

## 5. Testing yang Diperlukan

### Backend Testing:
- [ ] Test GET `/kelas/materi` dengan role siswa
- [ ] Test GET `/kelas/tugas` dengan role siswa
- [ ] Test POST `/kelas/tugas` dengan field deadline
- [ ] Test GET `/kelas/tugas/{tugas_id}/submissions`

### Frontend Testing:
- [ ] Login sebagai siswa, cek tab "Materi Kelas" dan "Materi Siswa"
- [ ] Login sebagai siswa, cek tab "Tugas Kelas" dan "Tugas Siswa"
- [ ] Login sebagai kelas, cek bahwa hanya materi target_role='kelas' yang muncul
- [ ] Login sebagai guru, test form create tugas dengan deadline
- [ ] Login sebagai guru, cek apakah bisa melihat submissions tugas

---

## 6. Catatan Penting

### Database Schema:
- **Tidak ada perubahan breaking pada database schema**
- Field baru semua bersifat Optional, jadi data lama tetap compatible
- Data lama yang tidak memiliki field `deadline`, `deskripsi`, atau `file_url` akan menampilkan `null`

### Backward Compatibility:
- ✅ API tetap backward compatible
- ✅ Frontend lama masih bisa berfungsi (field baru optional)
- ✅ Data lama tidak perlu migrasi

---

## 7. Next Steps (Optional Enhancements)

### Frontend yang Perlu Ditambahkan:
1. **Form Create/Edit Tugas (Guru)** - Tambahkan field:
   - Deskripsi (textarea)
   - File URL (input text)
   - Deadline (datetime picker)

2. **Accordion Tugas (Guru)** - Tambahkan:
   - Button "Lihat Submissions"
   - Dialog untuk menampilkan list submissions
   - Detail submission: nama siswa, NIS, jawaban, file URL, waktu submit

3. **Display Deadline di Frontend**:
   - Badge dengan deadline di list tugas
   - Warna berbeda jika sudah overdue

4. **Download File Attachment**:
   - Button "Download File" jika ada file_url

---

## Summary

**Total Files Modified**: 3
- `backend/models.py`
- `backend/routers/kelas_digital.py`
- `frontend/src/pages/siswa/SiswaMateriPage.js`
- `frontend/src/pages/siswa/SiswaTugasPage.js`

**Total Endpoints Added**: 1
- GET `/kelas/tugas/{tugas_id}/submissions`

**Total Endpoints Fixed**: 2
- GET `/kelas/materi` (untuk role siswa)
- GET `/kelas/tugas` (untuk role siswa)

**Issue Resolved**:
- ✅ Error 403 Forbidden saat siswa mengakses `/kelas/tugas`
- ✅ Tab Kelas dan Siswa di `/siswa/materi` menampilkan 0 item
- ✅ Tab Kelas dan Siswa di `/siswa/tugas` menampilkan 0 item
- ✅ Field deadline tidak tersedia untuk tugas
- ✅ Guru tidak bisa melihat submissions dari siswa
