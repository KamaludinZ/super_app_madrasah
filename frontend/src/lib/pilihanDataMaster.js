/**
 * Isian pilihan yang tersedia di aplikasi untuk Data Siswa & GTK — satu sumber untuk form detail siswa,
 * template/legenda impor, dan validasi. HARUS sama dengan backend data_master_excel.py
 * (PILIHAN_SISWA & PILIHAN_GTK, fungsi opsi_kolom / label_opsi).
 */

// ---- Pilihan form detail siswa (disimpan apa adanya) ----
export const AGAMA_OPTIONS = ['Islam', 'Kristen Protestan', 'Katolik', 'Hindu', 'Buddha', 'Kong hu cu'];
export const CITA_CITA_OPTIONS = ['PNS', 'TNI/Polri', 'Guru/Dosen', 'Dokter', 'Politikus', 'Wiraswasta', 'Seniman/Artis', 'Ilmuwan', 'Agamawan', 'Lainnya'];
export const HOBI_OPTIONS = ['Olahraga', 'Kesenian', 'Membaca', 'Menulis', 'Jalan-jalan', 'Lainnya'];
export const PEMBIAYA_OPTIONS = ['Orang Tua', 'Wali/Orang Tua Asuh', 'Tanggungan Sendiri', 'Lainnya'];
export const PRA_SEKOLAH_OPTIONS = ['Pernah TK/RA', 'Pernah PAUD'];
export const IMUNISASI_OPTIONS = ['Hepatitis B', 'BCG', 'DPT', 'Polio', 'Campak', 'Covid'];
export const PENDIDIKAN_OPTIONS = ['SD/Sederajat', 'SMP/Sederajat', 'SMA/Sederajat', 'D1', 'D2', 'D3', 'D4/S1', 'S2', 'S3', 'Tidak Sekolah', 'Lainnya'];
export const PEKERJAAN_OPTIONS = ['Tidak Bekerja', 'Pensiunan', 'PNS', 'TNI/Polri', 'Guru/Dosen', 'Pegawai Swasta', 'Wiraswasta', 'Pengacara/Jaksa/Hakim/Notaris', 'Seniman/Pelukis/Artis/Sejenis', 'Dokter/Bidan/Perawat', 'Pilot/Pramugara', 'Pedagang', 'Petani/Peternak', 'Nelayan', 'Buruh (Tani/Pabrik/Bangunan)', 'Sopir/Masinis/Kondektur/Tukang Ojek', 'Politikus', 'Lainnya'];
export const PENGHASILAN_OPTIONS = ['Di bawah 800.000', '800.001-1.200.000', '1.200.001-1.800.000', '1.800.001-2.500.000', '2.500.001-3.500.000', '3.500.001-4.800.000', '4.800.001-6.500.000', '6.500.001-10.000.000', '10.000.001-20.000.000', 'Lebih dari 20.000.000'];
export const STATUS_RUMAH = ['Milik Sendiri', 'Rumah Orang Tua', 'Rumah Saudara/Kerabat', 'Rumah Dinas', 'Sewa/Kontrak', 'Lainnya'];
export const STATUS_HIDUP = ['Masih Hidup', 'Sudah Meninggal', 'Tidak Diketahui'];
export const KEWARGANEGARAAN_OPTIONS = ['WNI', 'WNA'];
export const HUBUNGAN_WALI_OPTIONS = ['Sama dengan ayah kandung', 'Sama dengan ibu kandung', 'Lainnya'];
export const STATUS_TEMPAT_TINGGAL_SISWA = ['Tinggal dengan Ayah Kandung', 'Tinggal dengan Ibu Kandung', 'Tinggal dengan Wali', 'Ikut Saudara/Kerabat', 'Asrama Madrasah', 'Kontrak/Kost', 'Tinggal di Asrama Pesantren', 'Panti Asuhan', 'Rumah Singgah', 'Lainnya'];
export const JARAK_TEMPUH_OPTIONS = ['Kurang dari 5 km', '5-10 km', '11-20 km', '21-30 km', 'Lebih dari 30 km'];
export const TRANSPORTASI_SISWA = ['Jalan Kaki', 'Sepeda', 'Sepeda Motor', 'Mobil Pribadi', 'Antar Jemput Sekolah', 'Angkutan Umum', 'Perahu/Sampan', 'Kendaraan Pribadi', 'Kereta Api', 'Ojek', 'Andong/Bendi/Sado/Dokar/Delman/Becak', 'Lainnya'];
export const WAKTU_TEMPUH_OPTIONS = ['1-10 menit', '10-19 menit', '20-29 menit', '30-39 menit', '1-2 jam', 'Lebih dari 2 jam'];

/** Pilihan field detail siswa (student_details) per nama field. */
export const PILIHAN_SISWA = {
  citizenship: KEWARGANEGARAAN_OPTIONS,
  agama: AGAMA_OPTIONS,
  cita_cita: CITA_CITA_OPTIONS,
  hobi: HOBI_OPTIONS,
  pembiaya_sekolah: PEMBIAYA_OPTIONS,
  pra_sekolah: PRA_SEKOLAH_OPTIONS,
  imunisasi: IMUNISASI_OPTIONS,
  status: STATUS_HIDUP,
  pendidikan: PENDIDIKAN_OPTIONS,
  pekerjaan: PEKERJAAN_OPTIONS,
  penghasilan: PENGHASILAN_OPTIONS,
  hubungan_wali: HUBUNGAN_WALI_OPTIONS,
  status_wali: HUBUNGAN_WALI_OPTIONS,
  status_kepemilikan: STATUS_RUMAH,
  status_tempat_tinggal: STATUS_TEMPAT_TINGGAL_SISWA,
  jarak_tempuh: JARAK_TEMPUH_OPTIONS,
  transportasi: TRANSPORTASI_SISWA,
  waktu_tempuh: WAKTU_TEMPUH_OPTIONS,
};

/** Pilihan berkode field akun (users) — kode tersimpan -> label (sama dengan form detail GTK). */
export const PILIHAN_GTK = {
  status_kepegawaian: { pns: 'PNS', pppk: 'PPPK', non_asn: 'Non ASN' },
  status_tempat_tinggal: { milik_sendiri: 'Milik Sendiri', sewa: 'Sewa/Kontrak', menumpang: 'Menumpang', dinas: 'Rumah Dinas' },
  status_perkawinan: { belum_menikah: 'Belum Menikah', menikah: 'Menikah', duda: 'Duda', janda: 'Janda' },
  gender: { L: 'Laki-laki', P: 'Perempuan' },
  jenis_ptk: { guru_mapel: 'Guru Mata Pelajaran', guru_bk: 'Guru BK', kepala_sekolah: 'Kepala Sekolah', tenaga_administrasi: 'Tenaga Administrasi', pustakawan: 'Pustakawan', laboran: 'Laboran' },
  agama: { islam: 'Islam', kristen: 'Kristen', katolik: 'Katolik', hindu: 'Hindu', buddha: 'Buddha', konghucu: 'Konghucu' },
  golongan_darah: { A: 'A', B: 'B', AB: 'AB', O: 'O' },
  transportasi: { jalan_kaki: 'Jalan Kaki', sepeda: 'Sepeda', motor: 'Sepeda Motor', mobil: 'Mobil Pribadi', angkutan_umum: 'Angkutan Umum' },
};

const fieldDari = (k) => String(k?.path || '').split('.').pop();

/** Isian yang tersedia di aplikasi untuk satu kolom template (kosong = teks bebas). */
export function opsiKolom(k) {
  const path = String(k?.path || '');
  const field = fieldDari(k);
  if (path.startsWith('user.') && PILIHAN_GTK[field]) return Object.keys(PILIHAN_GTK[field]);
  if (path.startsWith('detail.') && PILIHAN_SISWA[field]) return [...PILIHAN_SISWA[field]];
  return [];
}

/** Opsi untuk dibaca: kode GTK beserta labelnya ('islam = Islam'), pilihan siswa apa adanya. */
export function labelOpsi(k) {
  const path = String(k?.path || '');
  const field = fieldDari(k);
  if (path.startsWith('user.') && PILIHAN_GTK[field]) {
    return Object.entries(PILIHAN_GTK[field]).map(([kd, lb]) => (kd === lb ? kd : `${kd} = ${lb}`));
  }
  return opsiKolom(k);
}
