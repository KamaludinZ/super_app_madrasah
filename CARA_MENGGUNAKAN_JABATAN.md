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

**Jika jabatan diubah di `/admin/users`, maka di `/public/agenda` akan OTOMATIS berubah!**

Tidak perlu refresh atau reload apapun. Begitu user di-edit dan jabatannya diganti, kegiatan pegawai akan langsung menampilkan jabatan yang baru.

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

1. Buka `/admin/users`
2. Klik Edit pada user
3. Lihat dropdown **"Jabatan"** → Apa yang terpilih?
4. Jika masih "Guru Mata Pelajaran" → Ganti ke jabatan yang benar
5. Simpan
6. Buka `/public/agenda` → Langsung berubah!

## ❓ FAQ

**Q: Kenapa "Belum ditentukan" muncul?**
A: User belum dipilihkan jabatan di `/admin/users`. Edit user dan pilih jabatan.

**Q: Apakah bisa user punya lebih dari 1 jabatan?**
A: Bisa! Tapi yang ditampilkan di public agenda hanya **jabatan pertama**.

**Q: Bagaimana cara mengganti jabatan?**
A: Edit user di `/admin/users`, ganti jabatan, simpan. Langsung berubah di public agenda!

**Q: Apakah perlu restart aplikasi?**
A: TIDAK! Perubahan langsung real-time.

---

**Created**: 2026-08-10
**Version**: 1.2.1
