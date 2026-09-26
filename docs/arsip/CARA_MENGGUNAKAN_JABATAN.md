# Cara Menggunakan Fitur Jabatan

## Bagaimana Sistem Bekerja

Sistem **SUDAH BENAR** dan **OTOMATIS** mengambil jabatan dari kolom "Jabatan" di `/admin/users`.

### Alur Kerja:
1. Admin membuka `/admin/users` → Edit user
2. Di form edit user, ada dropdown **"Jabatan"** → Admin pilih jabatan
3. Data disimpan di field `jabatan_ids` (array, bisa lebih dari 1)
4. Saat tampil di `/public/agenda` → Sistem ambil **jabatan pertama** dari `jabatan_ids`
5. Jika user tidak punya jabatan → Tampil **"Belum ditentukan"**

## ✅ Sistem Sudah Otomatis

**Jika jabatan diubah di `/admin/users`, maka di semua halaman akan OTOMATIS berubah!**

Halaman yang menampilkan jabatan:
- `/public/agenda` (Tab: Kegiatan Pegawai)
- `/admin/gtk/agenda-guru` (Kolom: Jabatan)
- `/admin/gtk/agenda-tendik` (Kolom: Jabatan)

Tidak perlu refresh atau reload apapun. Begitu user di-edit dan jabatannya diganti, semua halaman di atas akan langsung menampilkan jabatan yang baru.

## ⚠️ Mengapa Masih Muncul "Guru Mata Pelajaran"?

Jika di `/public/agenda` masih muncul **"Guru Mata Pelajaran"**, artinya:

1. Di database collection `jabatan`, ada entry dengan `name: "Guru Mata Pelajaran"`
2. User tersebut di `/admin/users` punya `jabatan_ids` yang menunjuk ke entry jabatan tersebut
3. **INI BUKAN BUG** - sistem sudah benar mengambil dari jabatan
4. **Masalahnya adalah DATA** - master data jabatan masih pakai nama role

## 🔧 Cara Memperbaiki

### Step 1: Buat Master Data Jabatan yang Benar

1. Buka `/admin/jabatan`
2. Buat jabatan baru dengan nama yang sesuai:
   - ✅ "Wakil Kepala Kurikulum"
   - ✅ "Wakil Kepala Kesiswaan"
   - ✅ "Bendahara"
   - ✅ "Staff TU"
   - ✅ "Koordinator Ekstrakurikuler"
   - ❌ JANGAN pakai "Guru Mata Pelajaran" (ini nama role!)
   - ❌ JANGAN pakai "Wali Kelas" (ini nama role!)

### Step 2: Edit User dan Ganti Jabatannya

1. Buka `/admin/users`
2. Klik Edit pada user yang jabatannya masih "Guru Mata Pelajaran"
3. Di dropdown **"Jabatan"**, pilih jabatan yang BENAR (misal: "Wakil Kepala Kurikulum")
4. Simpan

### Step 3: Cek Hasilnya

1. Buka `/public/agenda`
2. Tab "Kegiatan Pegawai"
3. Lihat kolom **"Jabatan"** - sekarang sudah berubah!

### Step 4: Hapus Jabatan dengan Nama Role

1. Setelah semua user sudah dipindah ke jabatan yang benar
2. Buka `/admin/jabatan`
3. Hapus entry "Guru Mata Pelajaran", "Wali Kelas", dll
4. Sistem akan mencegah penghapusan jika masih ada user yang menggunakan

## 📊 Contoh Data yang Benar

### Collection: `users`
```json
{
  "id": "user-123",
  "full_name": "Dra. Siti Aminah, M.Pd",
  "nip": "197001051995032001",
  "roles": ["guru", "wali_kelas"],  // Role untuk akses sistem
  "jabatan_ids": ["jab-001"]        // Jabatan struktural (ID dari collection jabatan)
}
```

### Collection: `jabatan`
```json
{
  "id": "jab-001",
  "name": "Wakil Kepala Kurikulum",  // ✅ Nama posisi, BUKAN role
  "description": "Wakil kepala madrasah bidang kurikulum",
  "is_active": true
}
```

### API Response di `/public/agenda`
```json
{
  "staff_events": [{
    "user_name": "Dra. Siti Aminah, M.Pd",
    "nip": "197001051995032001",
    "jabatan": "Wakil Kepala Kurikulum"  // ✅ Benar - bukan "Guru Mata Pelajaran"
  }]
}
```

## 🔍 Cara Cek Jabatan User

### Di Halaman Admin Users:
1. Buka `/admin/users`
2. Lihat **kolom "Jabatan"** (di sebelah kiri kolom "Email")
3. Jika ada badge nama jabatan → User sudah punya jabatan ✅
4. Jika kosong (-) → User belum punya jabatan ❌

### Cara Menambahkan Jabatan:
1. Buka `/admin/users`
2. Klik Edit pada user yang belum punya jabatan
3. Scroll ke bagian **"Jabatan (boleh lebih dari satu)"**
4. Centang jabatan yang sesuai (misal: "Wakil Kepala Kurikulum")
5. Klik **"Simpan"**
6. Lihat tabel → Sekarang muncul badge jabatan di kolom "Jabatan"
7. Buka `/public/agenda`, `/admin/gtk/agenda-guru`, atau `/admin/gtk/agenda-tendik` → Langsung berubah!

## ❓ FAQ

**Q: Kenapa "Belum ditentukan" muncul di kolom jabatan?**
A: User tersebut belum dipilihkan jabatan di `/admin/users`.
   - Buka `/admin/users`
   - Lihat kolom "Jabatan" (di sebelah kiri kolom "Email")
   - Jika kosong (-), artinya user belum punya jabatan
   - Edit user → Centang jabatan → Simpan

**Q: Saya sudah pilih jabatan di `/admin/users`, kenapa masih "Belum ditentukan"?**
A: Pastikan:
   1. Jabatan sudah di-centang di form edit user
   2. Tombol "Simpan" sudah diklik
   3. Tidak ada error saat menyimpan (cek notifikasi toast)
   4. Lihat kembali di tabel `/admin/users`, kolom "Jabatan" harus muncul badge nama jabatan
   5. Jika badge sudah muncul di `/admin/users`, tapi masih "Belum ditentukan" di agenda → Refresh halaman agenda

**Q: Apakah bisa user punya lebih dari 1 jabatan?**
A: Bisa! Tapi yang ditampilkan di agenda hanya **jabatan pertama**.

**Q: Bagaimana cara mengganti jabatan?**
A: Edit user di `/admin/users`, ganti jabatan, simpan. Langsung berubah di semua halaman!

**Q: Apakah perlu restart aplikasi?**
A: TIDAK! Perubahan langsung real-time (refresh halaman jika perlu).

---

**Created**: 2026-08-10
**Version**: 1.2.1
