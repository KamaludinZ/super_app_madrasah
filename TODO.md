# TODO - Full Implement + Testing Verval Workflow (A/B/C)

- [ ] Backend: perluas model/verval flow untuk request_type `profile_update` & `prestasi_create`
- [ ] Backend: reviewer role `admin` + `wali_kelas`, termasuk filtering scope data
- [ ] Backend: approval logic apply ke `users` (profile_update) dan `achievements` (prestasi_create)
- [ ] Backend: reject logic + audit + validasi ownership submitter
- [ ] Frontend siswa: submit perubahan profil jadi verval request (bukan direct update) untuk role siswa
- [ ] Frontend siswa: submit prestasi jadi verval request (`old_data` kosong, `new_data` berisi payload)
- [ ] Frontend reviewer: halaman verval menampilkan tipe request + diff before/after + aksi approve/reject
- [ ] API testing (curl): profile_update flow submit/list/approve/reject + verifikasi side effects
- [ ] API testing (curl): prestasi_create flow submit/list/approve/reject + verifikasi side effects
- [ ] UI testing critical flow: siswa submit + reviewer review approve/reject
- [ ] Bugfix dari hasil testing hingga alur stabil
