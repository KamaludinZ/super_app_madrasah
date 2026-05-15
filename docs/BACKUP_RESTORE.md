# Backup, Restore & Export Data

## Backup JSON (Snapshot Lengkap)

Buka menu **Backup & Restore** → **Export Backup (JSON)**.

File JSON berisi seluruh data: users, classes, schedules, journals, grades, prestasi, ekstrakurikuler, log, dll. Sekitar 22 koleksi MongoDB.

### Kapan Wajib Backup?

- Sebelum **migrasi TP baru** (tahun ajaran baru).
- Sebelum **import massal** (siswa baru, mapel baru, dst).
- Sebelum **rapor akhir semester** dibagikan.
- Sebelum **maintenance besar** atau update sistem.
- **Minimal 1x per minggu** untuk operasional rutin.

## Restore JSON

### Mode "Merge" (Default — AMAN)
Data baru dari backup ditambahkan, data yang sudah ada di-update berdasarkan ID. **Tidak menghapus** data yang tidak ada di backup.

Cocok untuk:
- Restore selektif setelah salah hapus.
- Sinkronisasi data dari backup lain.

### Mode "Replace" (BERBAHAYA)
**Hapus semua data lalu insert dari backup.** Gunakan hanya untuk:
- Migrasi total ke environment baru.
- Reset sistem ke kondisi sebelum kerusakan.

> ⚠️ Aktifkan **Mode Maintenance** saat melakukan restore Replace agar pengguna tidak mengganggu proses. Lihat panduan: matikan akses non-admin sementara melalui Pengaturan → Maintenance.

### Langkah Restore
1. Aktifkan Mode Maintenance (opsional tapi sangat disarankan).
2. Buka **Backup & Restore** → **Import Backup**.
3. Pilih file JSON.
4. Pilih mode (Merge / Replace).
5. Konfirmasi — sistem akan menampilkan ringkasan jumlah dokumen yang di-restore.
6. Test sistem dengan login admin & cek beberapa data kunci.
7. Matikan Mode Maintenance.

## Export Excel (Subset Data)

Untuk laporan ke Kemenag / pihak luar / arsip, gunakan **Export Excel** di halaman Backup & Restore:

| Tombol | Isi |
|--------|-----|
| **Users** | Semua akun: username, nama lengkap, NIP, NISN, email, roles, status aktif, mutasi |
| **Siswa** | Data siswa: NISN, nama, kelas, gender, alamat, status mutasi |
| **Jadwal** | Jadwal mingguan: hari, jam, kelas, mapel, guru, ruang, semester, status |
| **Nilai** | Rekap nilai per siswa per mapel per semester: pengetahuan, keterampilan, akhir, predikat |

File Excel dapat dibuka langsung di Excel/LibreOffice/Google Sheets dan langsung dipakai untuk laporan.

File menggunakan tema warna sekolah (header hijau Kemenag) dan freeze panes pada baris pertama supaya mudah scroll.

## Log Backup

Setiap export & import dicatat di **Log Backup** dengan:
- Tanggal & jam
- Jenis operasi (export / import_merge / import_replace)
- Total dokumen
- Pengguna yang melakukan

Gunakan log ini untuk audit & compliance.

## Best Practice

1. Simpan backup di **minimal 2 tempat**: download lokal + cloud (Google Drive / OneDrive / NAS sekolah).
2. Beri nama file backup dengan tanggal: `backup_matsandatama_2026-05-13.json`.
3. Test restore di TP non-aktif **sekali setahun** untuk memastikan backup valid.
4. Hapus backup lama (> 1 tahun) jika storage terbatas, tapi simpan minimal **4 backup terakhir**.
5. Backup sebelum **setiap** kegiatan beresiko (import massal, migrasi, dst).
6. **Jangan share file backup** sembarangan — berisi data pribadi siswa (NIK, alamat).
