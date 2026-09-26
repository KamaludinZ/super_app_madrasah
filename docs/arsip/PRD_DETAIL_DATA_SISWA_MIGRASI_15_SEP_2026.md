# PRD: Detail Data Siswa (Admin → Pendaftar) untuk Duplikasi/Migrasi Antar Aplikasi

**Sumber referensi:** `/admin/pendaftar/{id}` (contoh: `/admin/pendaftar/661`) → `App\Livewire\Admin\DetailPendaftar`
**Tujuan dokumen:** Menjadi kontrak data lengkap agar tim dapat (1) mereplikasi struktur tab "Detail Pendaftar" di aplikasi PPDB lain, dan (2) mengimpor data dari aplikasi ini ke aplikasi lain tanpa kehilangan informasi.
**Tanggal:** 2026-09-15

---

## 1. Ringkasan Arsitektur Data

Satu pendaftar direpresentasikan oleh 1 baris di tabel `pendaftar` (entity utama) + beberapa tabel anak (relasi 1-ke-banyak atau 1-ke-1):

```
pendaftar (1)
 ├── dokumen (1..n)              -- file upload per jenis dokumen
 ├── verifikasi_berkas (1)       -- status verifikasi per jenis dokumen
 ├── prestasi (0..n)             -- tab "Prestasi Siswa"
 ├── keahlian (0..n)             -- tab "Keahlian"
 ├── tahfidz (0..1)              -- tab "Tahfidz"
 ├── beasiswa (0..n)             -- tab "Beasiswa & Bantuan"
 ├── pendidikan_lain (0..n)      -- tab "Pendidikan Lain"
 ├── daftar_ulang (0..1)
 ├── seragam (0..1)
 ├── tes_psikologi_pendaftar (0..1)
 ├── survey_answer (0..n)
 └── riwayat_pesan (0..n)
```

Model: `app/Models/Pendaftar.php` — relasi didefinisikan lengkap dengan alias (contoh: `prestasis()` dan alias `prestasi()`).

Halaman "Detail Pendaftar" (admin & panitia) menampilkan 8 tab sesuai permintaan:
1. **Data Siswa** (`tab-data-siswa.blade.php`)
2. **Data Orang Tua & Wali** (`tab-data-orangtua.blade.php`)
3. **Data Alamat** (`tab-data-alamat.blade.php`)
4. **Prestasi Siswa** (`tab-data-prestasi.blade.php`)
5. **Keahlian** (`tab-keahlian.blade.php`)
6. **Tahfidz** (`tab-tahfidz.blade.php`)
7. **Beasiswa & Bantuan** (`tab-beasiswa.blade.php`)
8. **Pendidikan Lain** (`tab-pendidikan-lain.blade.php`)

Setiap tab punya mode **View** dan mode **Edit** (toggle via `wire:click="toggleEdit('nama_tab')"`), dengan tombol Simpan/Batal saat mode edit aktif. Untuk tab dengan data majemuk (prestasi, keahlian, beasiswa, pendidikan lain) formnya berbasis **list dinamis** (`prestasiList`, `keahlianList`, `beasiswaList`, `pendidikanLainList`) dengan tombol "Tambah" dan "Hapus" per baris.

---

## 2. Tab 1 — Data Siswa

Tabel: `pendaftar` (kolom langsung, bukan relasi).

### 2.1 Identitas Dasar
| Field DB | Label UI | Tipe Input | Validasi/Catatan |
|---|---|---|---|
| `foto` | Foto Pendaftar | file upload (image) | JPG/PNG max 2MB, disimpan sebagai path storage |
| `nama_lengkap` | Nama Lengkap | text | huruf saja, wajib |
| `nisn` | NISN | text numeric | wajib, 10 digit, unique |
| `jenis_kelamin` | Jenis Kelamin | select | enum `L` / `P`, wajib |
| `tempat_lahir` | Tempat Lahir | text | huruf saja, wajib |
| `tanggal_lahir` | Tanggal Lahir | date | wajib |

### 2.2 Kewarganegaraan
| Field DB | Label UI | Tipe Input | Validasi/Catatan |
|---|---|---|---|
| `kewarganegaraan` | Warga Negara | select (live) | `WNI` / `WNA`, wajib |
| `nik` | NIK | text numeric | wajib jika WNI, 16 digit |
| `negara_asal` | Asal Negara | text | wajib jika WNA |
| `nomor_kitas` | Nomor KITAS | text | wajib jika WNA |

### 2.3 Data Keluarga
| Field DB | Label UI | Tipe Input | Validasi/Catatan |
|---|---|---|---|
| `jumlah_saudara` | Jumlah Saudara | number | 0-99, wajib |
| `anak_ke` | Anak Ke | number | 1-99, wajib |
| `nomor_kk` | Nomor KK | text numeric | 16 digit, wajib |
| `nama_kepala_keluarga` | Nama Kepala Keluarga | text | huruf saja, wajib |

### 2.4 Agama & Cita-cita
| Field DB | Label UI | Tipe Input | Pilihan (dropdown statis) |
|---|---|---|---|
| `agama` | Agama | select | Islam, Kristen Protestan, Katolik, Hindu, Buddha, Kong Hu Cu |
| `cita_cita` | Cita-cita | select | PNS, TNI/Polri, Guru/Dosen, Dokter, Politikus, Wiraswasta, Seniman/Artis, Ilmuwan, Agamawan, Lainnya |

### 2.5 Kontak
| Field DB | Label UI | Tipe Input | Catatan |
|---|---|---|---|
| `tidak_punya_hp` | Checkbox "Tidak memiliki nomor HP" | checkbox (live) | jika true, field `no_hp` disembunyikan |
| `no_hp` | Nomor HP | tel numeric | max 15 digit, wajib jika `tidak_punya_hp` = false |
| `email` | Alamat Email Siswa | email | opsional |

### 2.6 Hobi & Pembiayaan
| Field DB | Label UI | Tipe Input | Pilihan |
|---|---|---|---|
| `hobi` | Hobi | select | Olahraga, Kesenian, Membaca, Menulis, Jalan-jalan, Lainnya |
| `yang_membiayai_sekolah` | Yang Membiayai Sekolah | select | Orang Tua, Wali/Orang Tua Asuh, Tanggungan Sendiri, Lainnya |

### 2.7 Pra Sekolah (checkbox ganda)
- `pra_sekolah_tk` — Pernah TK/RA (boolean)
- `pra_sekolah_paud` — Pernah PAUD (boolean)

### 2.8 Riwayat Imunisasi (checkbox ganda)
- `imunisasi_hepatitis_b`, `imunisasi_bcg`, `imunisasi_dpt`, `imunisasi_polio`, `imunisasi_campak`, `imunisasi_covid` — semua boolean

### 2.9 Kartu Indonesia Pintar (opsional)
- `nomor_kip` — text, max 25 karakter alfanumerik. Jika diisi, mengaktifkan field upload dokumen KIP di menu terpisah.

### Field tambahan di model tapi bukan bagian tab Data Siswa aktif (legacy/EMIS lain)
`nomor_kps`, `penerima_kps`, `penerima_kip`, `layak_pip`, `alasan_layak_pip`, `golongan_darah`, `tinggi_badan`, `berat_badan`, `bahasa_sehari_hari`, `yatim_piatu`, `nomor_telepon_rumah`, `nomor_hp`, `email_pribadi`, `jenis_tinggal`, `alat_transportasi`, `jarak_tempat_tinggal`, `waktu_tempuh`, `nomor_kitas` (duplikat field), `berkebutuhan_khusus` (boolean), `jenis_kebutuhan_khusus` (JSON), `keterangan_kondisi_khusus` — kolom ini ADA di database (hasil migration EMIS) namun sebagian tidak lagi tampil di tab aktif saat ini. **Rekomendasi:** tetap sertakan di skema aplikasi baru untuk kompatibilitas import, meski UI-nya opsional.

---

## 3. Tab 2 — Data Orang Tua & Wali

Struktur field **identik pola 3x** (Ayah / Ibu / Wali), prefix `ayah_`, `ibu_`, `wali_`.

### 3.1 Ayah
| Field DB | Label UI | Tipe | Pilihan/Catatan |
|---|---|---|---|
| `nama_ayah` | Nama Ayah | text | selalu wajib |
| `ayah_status` | Status Ayah | select (live) | `masih_hidup`, `meninggal`, `tidak_diketahui` |
| `ayah_kewarganegaraan` | Kewarganegaraan | select (live) | `WNI` / `WNA` — hanya tampil jika status = masih_hidup |
| `ayah_nik` | NIK Ayah | text | wajib jika WNI |
| `ayah_negara_asal` / `ayah_nomor_kitas` | Asal Negara / KITAS | text | wajib jika WNA |
| `ayah_tempat_lahir` / `ayah_tanggal_lahir` | Tempat/Tanggal Lahir | text/date | wajib jika masih_hidup |
| `ayah_pendidikan` | Pendidikan Terakhir | select | Tidak sekolah, Putus SD, SD Sederajat, SMP Sederajat, SMA Sederajat, D1, D2, D3, D4/S1, S2, S3 |
| `ayah_pekerjaan` | Pekerjaan | select | Tidak Bekerja, Pensiunan, PNS, TNI/Polri, Guru/Dosen, Pegawai Swasta, Wiraswasta, Pengacara/Jaksa/Hakim/Notaris, Seniman/Pelukis/Artis/Sejenis, Dokter/Bidan/Perawat, Pilot/Pramugara, Pedagang, Petani/Peternak, Nelayan, Buruh (Tani/Pabrik/Bangunan), Sopir/Masinis/Kondektur/Tukang Ojek, Politikus, Lainnya |
| `ayah_penghasilan` | Penghasilan | select | 10 rentang: <800rb, 800rb-1.2jt, 1.2-1.8jt, 1.8-2.5jt, 2.5-3.5jt, 3.5-4.8jt, 4.8-6.5jt, 6.5-10jt, 10-20jt, >20jt |
| `ayah_tidak_punya_hp` | Checkbox tidak punya HP | checkbox (live) | |
| `ayah_no_hp` | No HP Ayah | tel | wajib jika tidak dicentang "tidak punya hp" |
| `ayah_berkebutuhan_khusus` | (boolean, ada di model) | checkbox | |

### 3.2 Ibu — pola sama persis dengan prefix `ibu_` (pendidikan/pekerjaan/penghasilan pakai daftar pilihan identik).

### 3.3 Wali
| Field DB | Label UI | Tipe | Pilihan |
|---|---|---|---|
| `wali_hubungan` | Hubungan Wali | select (live) | `sama_ayah`, `sama_ibu`, `lainnya` — **catatan: di form pendaftar nilainya `sama_dengan_ayah`/`sama_dengan_ibu`, cek konsistensi saat migrasi** |
| `wali_status` | Status Wali | select (live) | sama seperti status ayah/ibu, hanya berlaku jika `wali_hubungan = lainnya` |
| `wali_kewarganegaraan`, `wali_pendidikan`, `wali_pekerjaan`, `wali_penghasilan`, `wali_tidak_punya_hp`, `wali_no_hp` | — sama pola dengan ayah/ibu | | |
| `nomor_kks`, `nomor_pkh` | Nomor Kartu Bantuan (KKS/PKH) | text | ditampilkan di bagian ini |

> ⚠️ **Catatan penting untuk migrasi:** Terdapat inkonsistensi penamaan value dropdown antara file form pendaftar (`Formulir.php`, pakai `sama_dengan_ayah`) dan tab admin (`tab-data-orangtua.blade.php`, pakai `sama_ayah`). Saat membangun skema baru, standarkan salah satu, dan saat mengimpor data lama, buat mapping eksplisit.

---

## 4. Tab 3 — Data Alamat

Struktur field alamat **berulang 4x**: Ayah, Ibu, Wali, Siswa — masing-masing prefix `ayah_`, `ibu_`, `wali_`, `siswa_`.

### 4.1 Pola field per entitas alamat
| Field DB (contoh prefix `ayah_`) | Label UI | Tipe | Catatan |
|---|---|---|---|
| `{prefix}_tinggal_luar_negeri` | Checkbox "Tinggal di luar negeri" | checkbox (live) | jika true → field alamat detail disembunyikan, ganti textarea alamat luar negeri |
| `{prefix}_status_kepemilikan_rumah` | Status Kepemilikan Rumah | select | Milik Sendiri, Rumah Orang Tua, Rumah Saudara/Kerabat, Rumah Dinas, Sewa/Kontrak, Lainnya |
| `{prefix}_provinsi` | Provinsi | select (cascading, live) | lihat §6 |
| `{prefix}_kabupaten` | Kabupaten/Kota | select (cascading, live, disabled jika provinsi kosong) | |
| `{prefix}_kecamatan` | Kecamatan | select (cascading, live, disabled jika kabupaten kosong) | |
| `{prefix}_kelurahan` | Kelurahan/Desa | select (cascading, live, disabled jika kecamatan kosong) | |
| `{prefix}_rt` / `{prefix}_rw` | RT / RW | text numeric | max 3 digit |
| `{prefix}_kode_pos` | Kode Pos | text | max 6 karakter, **auto-fill** dari lookup tabel `postal_codes` saat kelurahan dipilih (lihat §6.3), tetap bisa diedit manual |
| `alamat_{prefix}` (mis. `alamat_ayah`) atau `{prefix}_alamat` (mis. `siswa_alamat`) | Alamat Jalan/No Rumah | textarea | |

Field spesial:
- `ibu_sama_dengan_ayah` (checkbox live) — jika dicentang, semua field alamat ibu di-copy dari ayah dan field-nya di-disable.
- `wali_sama_dengan_ayah` — sama untuk wali.
- `wali_status_wali` — select: menentukan apakah field alamat wali relevan (hanya jika `lainnya`).
- `status_tempat_tinggal` (untuk siswa) — menentukan apakah alamat siswa harus diisi terpisah (jika `lainnya`) atau default ikut ayah.

### 4.2 Kolom alamat legacy di `pendaftar` (versi lama, sebelum detailed address fields)
`alamat`, `provinsi`, `kabupaten`, `kecamatan`, `desa`, `kode_pos` (tanpa prefix — dipakai formulir versi awal), `rt`, `rw`, `dusun`, `latitude`, `longitude`, `alamat_ayah`, `alamat_ibu`, `alamat_wali`. Ini kolom "flat" hasil migration awal proyek sebelum fitur detailed-address (per ayah/ibu/wali/siswa) ditambahkan. **Rekomendasi migrasi:** utamakan kolom `{prefix}_provinsi/kabupaten/kecamatan/kelurahan` yang detail; kolom flat lama dipertahankan hanya untuk backward-compat data historis.

---

## 5. Tab 4-8 — Data Majemuk (Relasi 1-ke-Banyak/1-ke-1)

### 5.1 Prestasi Siswa (`prestasi`, relasi `hasMany`)
| Field DB | Label UI | Tipe | Pilihan |
|---|---|---|---|
| `tahun` | Tahun | number | 1900 – tahun berjalan+1 |
| `nama_lomba` | Nama Lomba | text | |
| `bidang_lomba` | Bidang Lomba | select | Akademik, Keagamaan, Teknologi, Olahraga, Pramuka/Paskibraka, Karya Ilmiah, Kesenian, Pidato Bahasa Asing, Sains, Lainnya |
| `nama_penyelenggara` | Nama Penyelenggara | text | |
| `tingkat_lomba` | Tingkat Lomba | select | Kabupaten/Kota, Provinsi, Nasional, Internasional, Lainnya |
| `peringkat` | Peringkat | select | Tidak Meraih Juara, Juara 1/Medali Emas, Juara 2/Medali Perak, Juara 3/Medali Perunggu, Juara Harapan 1/2/3, Juara Favorit |
| `kategori_lomba` | Kategori Lomba | select | Individu, Kelompok |
| `file_sertifikat` | Upload Sertifikat | file | tidak selalu wajib per baris |

### 5.2 Keahlian (`keahlian`, `hasMany`)
| Field DB | Label UI | Tipe |
|---|---|---|
| `bidang_keahlian` | Bidang Keahlian | text (free text, contoh: Komputer, Bahasa, Musik) |
| `nama_keahlian` | Nama Keahlian | text |
| `sertifikasi` | Sertifikasi | text |
| `lembaga_penyelenggara` | Lembaga Penyelenggara | text |
| `hasil_tingkat_skor` | Hasil/Tingkat/Skor | text |
| `file_bukti_sertifikat` | Upload Bukti Sertifikat | file (PDF/gambar max 2MB) |

### 5.3 Tahfidz (`tahfidz`, `hasOne` — hanya 1 record per pendaftar)
| Field DB | Label UI | Tipe |
|---|---|---|
| `juz_alquran_dihafal` | Juz Al-Qur'an yang Dihafal | text free (contoh: "Juz 30", "Juz 1-5") |
| `file_bukti_syahadah` | Upload Bukti Syahadah | file |
| `file_bukti_tahsin` | Upload Bukti Tahsin | file |

### 5.4 Beasiswa & Bantuan (`beasiswa`, `hasMany`)
| Field DB | Label UI | Tipe | Pilihan |
|---|---|---|---|
| `tahun` | Tahun | number | |
| `kategori` | Kategori | select | Beasiswa Lainnya, Beasiswa Berprestasi, Beasiswa Kurang Mampu/Miskin, Beasiswa Miskin dan Berprestasi |
| `nama_beasiswa` | Nama Beasiswa/Bantuan | text | |
| `jenis_instansi_pemberi` | Jenis Instansi Pemberi | select | Kementerian Agama, Kementerian Lain, Pemerintah Daerah, BUMN, BUMD, Instansi Swasta, Yayasan, Perorangan, Lainnya |
| `nama_instansi_pemberi` | Nama Instansi Pemberi | text | |
| `jangka_waktu_bulan` | Jangka Waktu (Bulan) | number | 1-99 |
| `nominal_beasiswa` | Nominal Beasiswa (Rp) | number | step 1000 |

### 5.5 Pendidikan Lain (`pendidikan_lain`, `hasMany`)
| Field DB | Label UI | Tipe | Pilihan |
|---|---|---|---|
| `nama_lembaga` | Nama Lembaga | text | |
| `jenis_lembaga` | Jenis Lembaga | text free (contoh: Kursus, Les Privat, Pesantren) | |
| `mulai_belajar` | Mulai Belajar | date | |
| `frekuensi_belajar` | Frekuensi Belajar | select | Setiap Hari, Seminggu 2-3, Seminggu Sekali, Tidak Rutin |
| `lokasi_lembaga` | Lokasi Lembaga | textarea | |

---

## 6. Hirarki Wilayah (Provinsi → Kab/Kota → Kecamatan → Kelurahan) + Kode Pos

### 6.1 Struktur tabel wilayah (paket `azishapidin/laravel-indoregion`)

```
provinces
  id            CHAR(2)  PK   -- contoh: "35" = Jawa Timur
  name          VARCHAR

regencies
  id            CHAR(4)  PK   -- contoh: "3573" = Kota Malang
  province_id   CHAR(2)  FK → provinces.id
  name          VARCHAR(50)

districts
  id            CHAR(7)  PK
  regency_id    CHAR(4)  FK → regencies.id
  name          VARCHAR(50)

villages
  id            CHAR(10) PK
  district_id   CHAR(7)  FK → districts.id
  name          VARCHAR(50)
```

Model: `App\Models\Province`, `Regency`, `District`, `Village` (namespace trait `AzisHapidin\IndoRegion\Traits\*`). Relasi: `Province hasMany Regency`, `Regency belongsTo Province` + `hasMany District`, `District hasMany Village`.

> **Catatan teknis (technical debt, jangan dibawa ke aplikasi baru):** Repo ini punya SATU set migration duplikat lama dari paket berbeda (`laravolt/indonesia`, file `2016_08_03_*`, dengan struktur berbeda — `bigIncrements id`, kolom `code`, prefix tabel dinamis). Model aktif (`Province.php` dst.) memakai skema **IndoRegion** (`2017_05_02_*`, id char pendek). Saat membangun aplikasi baru, **pakai hanya skema IndoRegion** di atas — abaikan skema laravolt.

Data isi tabel: standar wilayah administratif Indonesia versi Kemendagri, tersedia sebagai seed publik dari paket `azishapidin/laravel-indoregion` (bisa langsung di-seed ulang di aplikasi baru, tidak perlu re-generate manual).

### 6.2 Mekanisme dropdown cascading (UI)

Pola yang konsisten dipakai di semua form (Formulir pendaftar & Detail Admin), untuk tiap grup alamat (`ayah`, `ibu`, `wali`, `siswa`):

```blade
<select wire:model.live="ayah_provinsi">
  <option value="">Pilih Provinsi</option>
  @foreach($provincesList as $province)
    <option value="{{ $province['id'] }}">{{ $province['name'] }}</option>
  @endforeach
</select>

<select wire:model.live="ayah_kabupaten" @if(!$ayah_provinsi) disabled @endif>
  ...
</select>
<!-- kecamatan & kelurahan pola sama, masing-masing disabled sampai parent terisi -->
```

Logika Livewire (contoh untuk grup `ayah`, pola sama untuk `ibu`/`wali`/`siswa`):

```php
public function mount() {
    $this->provincesList = Province::orderBy('name')->get()->map(fn($p) => ['id'=>$p->id,'name'=>$p->name]);
    // jika data sudah ada, load ulang cities/districts/villages list sesuai id tersimpan
}

public function updatedAyahProvinsi($value) {
    $this->ayah_kabupaten = null;
    $this->ayah_kecamatan = null;
    $this->ayah_kelurahan = null;
    $this->ayah_kode_pos = null;
    $this->ayahCitiesList = Regency::where('province_id', $value)->orderBy('name')->get()->map(...);
}

public function updatedAyahKabupaten($value) {
    // reset kecamatan, kelurahan, kode_pos
    $this->ayahDistrictsList = District::where('regency_id', $value)->orderBy('name')->get()->map(...);
}

public function updatedAyahKecamatan($value) {
    // reset kelurahan, kode_pos
    $this->ayahVillagesList = Village::where('district_id', $value)->orderBy('name')->get()->map(...);
}

public function updatedAyahKelurahan() {
    // trigger auto-fill kode pos, lihat §6.3
}
```

**Prinsip kunci untuk direplikasi:**
1. Setiap level select **disabled** sampai level parent terisi.
2. Setiap kali parent berubah, semua level anak **di-reset ke null** (mencegah kombinasi id yang tidak valid).
3. List opsi child (`ayahCitiesList`, dst.) di-refresh via query `WHERE parent_id = $selectedParentId` setiap kali parent berubah — bukan dimuat semua di awal (menghindari payload besar).
4. Saat re-edit data existing (`mount()`), semua level list harus di-preload berdasarkan value tersimpan agar dropdown langsung terisi tanpa harus klik ulang dari provinsi.

### 6.3 Auto-fill Kode Pos

Kode pos **tidak** tersedia sebagai kolom di tabel `villages` bawaan IndoRegion, sehingga aplikasi ini menambah tabel terpisah:

```
postal_codes
  id             bigint PK
  urban          VARCHAR(100)  -- nama kelurahan/desa
  sub_district   VARCHAR(100)  -- nama kecamatan
  city           VARCHAR(100)  -- nama kabupaten/kota
  province_code  INT           -- kode provinsi (11-92)
  postal_code    VARCHAR(5)
  INDEX (urban, sub_district, city)
  INDEX (postal_code)
  INDEX (province_code)
```

Saat user memilih Kelurahan (`updated{Prefix}Kelurahan()`), sistem melakukan **matching berbasis nama** (bukan foreign key, karena `postal_codes` adalah dataset independen tanpa relasi id ke `villages`):

```php
$village  = Village::find($this->ayah_kelurahan);
$district = District::find($this->ayah_kecamatan);
$regency  = Regency::find($this->ayah_kabupaten);

$cityName = preg_replace('/^(KABUPATEN|KOTA)\s+/i', '', $regency->name); // hapus prefix

$postalCode = DB::table('postal_codes')
    ->where('urban', 'LIKE', '%' . $village->name . '%')
    ->where('sub_district', 'LIKE', '%' . $district->name . '%')
    ->where('city', 'LIKE', '%' . $cityName . '%')
    ->first();

if ($postalCode) {
    $this->ayah_kode_pos = $postalCode->postal_code;
}
// jika tidak ketemu / tabel postal_codes tidak ada → field kode pos tetap kosong,
// user isi manual (try/catch, fail-safe, tidak block form)
```

**Catatan desain penting untuk direplikasi:**
- Pendekatan ini **rapuh** (matching LIKE nama, bisa gagal karena variasi ejaan/singkatan nama wilayah antar dataset). Untuk aplikasi baru, **lebih disarankan** memakai dataset kode pos yang sudah di-mapping by `village_id` langsung (foreign key), bukan matching nama string. Jika ingin tetap pakai dataset `postal_codes` terpisah, tambahkan kolom `village_id` nullable dan lakukan one-time backfill matching, baru pakai id untuk lookup selanjutnya (lebih cepat & akurat).
- Kode pos **selalu bisa diedit manual** — auto-fill adalah kemudahan (UX), bukan constraint keras. Field validasi: `nullable|string|max:6` atau `required|string|max:6` tergantung status hidup/tinggal luar negeri ortu.

---

## 7. Skema JSON Export/Import (Kontrak Data Antar Aplikasi)

Format ini dirancang sebagai representasi **satu pendaftar lengkap**, dipakai baik untuk file export (`pendaftar_export_{nomor_pendaftaran}.json`) maupun payload API import ke aplikasi tujuan.

```json
{
  "meta": {
    "source_app": "ppdb-mtsn2-malang",
    "export_version": "1.0",
    "exported_at": "2026-09-15T10:00:00+07:00",
    "nomor_pendaftaran": "PPDB-2025-000661"
  },
  "data_siswa": {
    "nomor_pendaftaran": "PPDB-2025-000661",
    "nisn": "1234567890",
    "nik": "3573xxxxxxxxxxxx",
    "nama_lengkap": "CONTOH NAMA SISWA",
    "jenis_kelamin": "L",
    "tempat_lahir": "Malang",
    "tanggal_lahir": "2013-05-10",
    "agama": "Islam",
    "kewarganegaraan": "WNI",
    "negara_asal": null,
    "nomor_kitas": null,
    "foto": "storage/foto/661.jpg",
    "jumlah_saudara": 2,
    "anak_ke": 1,
    "nomor_kk": "3573xxxxxxxxxxxx",
    "nama_kepala_keluarga": "CONTOH NAMA AYAH",
    "hobi": "Olahraga",
    "cita_cita": "Dokter",
    "tidak_punya_hp": false,
    "no_hp": "081234567890",
    "email": "siswa@example.com",
    "yang_membiayai_sekolah": "Orang Tua",
    "pra_sekolah": { "tk": true, "paud": false },
    "imunisasi": {
      "hepatitis_b": true, "bcg": true, "dpt": true,
      "polio": true, "campak": true, "covid": false
    },
    "nomor_kip": null
  },
  "data_orang_tua": {
    "ayah": {
      "nama": "CONTOH NAMA AYAH",
      "status": "masih_hidup",
      "kewarganegaraan": "WNI",
      "nik": "3573xxxxxxxxxxxx",
      "negara_asal": null,
      "nomor_kitas": null,
      "tempat_lahir": "Malang",
      "tanggal_lahir": "1985-01-01",
      "pendidikan": "SMA Sederajat",
      "pekerjaan": "Wiraswasta",
      "penghasilan": "Rp. 3,500,001 - Rp. 4,800,000",
      "tidak_punya_hp": false,
      "no_hp": "081234500001",
      "berkebutuhan_khusus": false
    },
    "ibu": { "...": "struktur identik dengan ayah" },
    "wali": {
      "hubungan": "sama_dengan_ayah",
      "status": null,
      "nama": null,
      "...": "field lain null jika hubungan bukan 'lainnya'"
    },
    "kartu_bantuan": {
      "nomor_kks": null,
      "nomor_pkh": null
    }
  },
  "data_alamat": {
    "ayah": {
      "tinggal_luar_negeri": false,
      "status_kepemilikan_rumah": "Milik Sendiri",
      "wilayah": {
        "provinsi": { "id": "35", "nama": "JAWA TIMUR" },
        "kabupaten": { "id": "3573", "nama": "KOTA MALANG" },
        "kecamatan": { "id": "3573010", "nama": "KLOJEN" },
        "kelurahan": { "id": "3573010001", "nama": "KIDUL DALEM" }
      },
      "rt": "001",
      "rw": "002",
      "kode_pos": "65119",
      "alamat_jalan": "Jl. Contoh No. 10"
    },
    "ibu": { "sama_dengan_ayah": true, "...": "null jika sama_dengan_ayah true" },
    "wali": { "status_wali": null, "...": "null jika bukan lainnya" },
    "siswa": {
      "status_tempat_tinggal": "sama_dengan_ayah",
      "wilayah": null,
      "rt": null, "rw": null, "kode_pos": null, "alamat_jalan": null
    }
  },
  "prestasi": [
    {
      "tahun": 2023,
      "nama_lomba": "Olimpiade Sains Nasional",
      "bidang_lomba": "Sains",
      "nama_penyelenggara": "Kementerian Pendidikan",
      "tingkat_lomba": "Provinsi",
      "peringkat": "Juara 2/Medali Perak",
      "kategori_lomba": "Individu",
      "file_sertifikat": "storage/prestasi/661_1.pdf"
    }
  ],
  "keahlian": [
    {
      "bidang_keahlian": "Komputer",
      "nama_keahlian": "Adobe Photoshop",
      "sertifikasi": "Sertifikat Adobe",
      "lembaga_penyelenggara": "LPK Bina Komputer",
      "hasil_tingkat_skor": "Level Intermediate",
      "file_bukti_sertifikat": "storage/keahlian/661_1.pdf"
    }
  ],
  "tahfidz": {
    "juz_alquran_dihafal": "Juz 30",
    "file_bukti_syahadah": "storage/tahfidz/661_syahadah.pdf",
    "file_bukti_tahsin": null
  },
  "beasiswa": [
    {
      "tahun": 2024,
      "kategori": "Beasiswa Berprestasi",
      "nama_beasiswa": "Beasiswa Prestasi Kemenag",
      "jenis_instansi_pemberi": "Kementerian Agama",
      "nama_instansi_pemberi": "Kemenag Kota Malang",
      "jangka_waktu_bulan": 12,
      "nominal_beasiswa": 5000000
    }
  ],
  "pendidikan_lain": [
    {
      "nama_lembaga": "Lembaga Kursus Bahasa Inggris ABC",
      "jenis_lembaga": "Kursus",
      "mulai_belajar": "2022-06-01",
      "frekuensi_belajar": "Seminggu 2-3",
      "lokasi_lembaga": "Jl. Contoh No. 5, Malang"
    }
  ],
  "dokumen": [
    {
      "jenis_dokumen": "kartu_keluarga",
      "nama_file": "kk_661.pdf",
      "path_file": "storage/dokumen/kk_661.pdf",
      "status_verifikasi": "diterima"
    }
  ]
}
```

### 7.1 Aturan mapping wilayah saat import ke aplikasi lain

Karena `id` provinsi/kab-kota/kecamatan/kelurahan bersifat spesifik ke dataset IndoRegion, JSON export **selalu menyertakan `nama` wilayah, bukan hanya `id`**, supaya aplikasi tujuan bisa:
1. Jika aplikasi tujuan pakai dataset wilayah yang sama (IndoRegion) → cukup pakai `id` langsung.
2. Jika aplikasi tujuan pakai dataset berbeda (mis. Laravolt Indonesia, atau API Kemendagri lain) → lakukan matching berdasarkan `nama` (uppercase, exact atau fuzzy) sebagai fallback.

### 7.2 Aturan penanganan file (dokumen/foto/sertifikat)

Path file dalam JSON adalah path **relatif ke storage lokal aplikasi sumber** — bukan URL publik. Untuk migrasi lintas aplikasi, sertakan sebagai:
- **Opsi A (disarankan untuk volume kecil):** bundel file fisik dalam ZIP terpisah, JSON hanya berisi nama file relatif, proses import men-copy file ke storage aplikasi tujuan lalu update path.
- **Opsi B:** JSON menyertakan file sebagai base64 (hanya untuk file kecil, tidak disarankan untuk PDF/foto beresolusi tinggi karena ukuran payload membengkak).

---

## 8. Rekomendasi Implementasi di Aplikasi Baru

1. **Wilayah:** seed tabel `provinces`, `regencies`, `districts`, `villages` persis skema IndoRegion (char PK pendek, bukan bigIncrements) — lebih ringan dan sudah battle-tested di aplikasi ini. Jangan bawa skema Laravolt yang tidak terpakai.
2. **Kode pos:** pertimbangkan memakai dataset kode pos yang sudah punya `village_id` (FK langsung) alih-alih matching nama LIKE seperti di aplikasi ini — akan jauh lebih presisi dan cepat.
3. **Struktur tabel anak (prestasi/keahlian/beasiswa/pendidikan_lain):** pertahankan sebagai tabel terpisah dengan relasi `hasMany`, bukan JSON column — memudahkan query, sorting, dan reporting (kolom `prestasi` lama bertipe `text`/JSON di tabel `pendaftar` adalah legacy dan sudah digantikan tabel `prestasis`).
4. **Konsistensi penamaan enum:** standarkan value seperti `sama_dengan_ayah` vs `sama_ayah` sebelum membangun ulang — jangan ikut duplikasi inkonsistensi yang ada di aplikasi sumber (lihat catatan §3.3).
5. **Field kondisional (conditional required):** logika "field X wajib jika field Y = tertentu" (co: alamat ayah wajib jika `ayah_status = masih_hidup` dan tidak `tinggal_luar_negeri`) sebaiknya dipusatkan dalam satu service/helper validasi, bukan diulang di tiap Livewire component (saat ini terduplikasi antara `Formulir.php`, `DetailPendaftar.php` Admin, dan `DetailPendaftar.php` Panitia).
6. **Import bertahap:** karena banyak field opsional/kondisional, proses import sebaiknya per-tab (data siswa dulu, baru orang tua, alamat, dst.) dengan validasi longgar (`nullable`) di tahap awal, lalu jalankan `isRequiredTabsCompleted()`-equivalent check di akhir untuk audit kelengkapan data hasil migrasi.

---

## 9. Lampiran: Referensi File Sumber

| Area | File |
|---|---|
| Model utama | `app/Models/Pendaftar.php` |
| Model anak | `app/Models/Prestasi.php`, `Keahlian.php`, `Tahfidz.php`, `Beasiswa.php`, `PendidikanLain.php`, `AsalSekolah.php` |
| Model wilayah | `app/Models/Province.php`, `Regency.php`, `District.php`, `Village.php` |
| Model dokumen | `app/Models/Dokumen.php`, `VerifikasiBerkas.php` |
| Migration dasar pendaftar | `database/migrations/2026_01_05_062532_create_pendaftar_table.php` (+ ±20 migration `add_*_to_pendaftar*` berikutnya) |
| Migration wilayah aktif | `database/migrations/2017_05_02_140432_*` s/d `2017_05_02_143454_*` |
| Migration kode pos | `database/migrations/2026_01_15_051817_create_postal_codes_table.php` |
| Livewire detail admin | `app/Livewire/Admin/DetailPendaftar.php` |
| Livewire form pendaftar (sumber logika cascading dropdown) | `app/Livewire/Pendaftar/Formulir.php` |
| Blade tab | `resources/views/tab_templates/tab-data-siswa.blade.php`, `tab-data-orangtua.blade.php`, `tab-data-alamat.blade.php`, `tab-data-prestasi.blade.php`, `tab-keahlian.blade.php`, `tab-tahfidz.blade.php`, `tab-beasiswa.blade.php`, `tab-pendidikan-lain.blade.php` |
| Route | `routes/web.php` — `admin.pendaftar.detail` (`/admin/pendaftar/{id}`) |
