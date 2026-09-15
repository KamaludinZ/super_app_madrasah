# Token Kelas Digital

**Generated on**: 2026-09-08
**Total Classes**: 11

## Daftar Token Kelas

Gunakan token ini untuk login di halaman **Kelas Digital** (`/kelas-login`)

| No | Nama Kelas | Token | Semester ID | Keterangan |
|----|------------|-------|-------------|------------|
| 1  | 7A | `7A-2026-AH5QA5` | - | Semester tidak ditentukan |
| 2  | 7A | `7A-2526-5UVZ` | Genap (6acbe0b0...) | |
| 3  | 7B | `7B-2026-BAY8SX` | - | Semester tidak ditentukan |
| 4  | 7B | `7B-2526-T2LT` | Genap (6acbe0b0...) | |
| 5  | 7C | `7C-2026-WFTDD9` | - | Semester tidak ditentukan |
| 6  | 8A | `8A-2026-N8B71J` | - | Semester tidak ditentukan |
| 7  | 8B | `8B-2026-WIJX7B` | - | Semester tidak ditentukan |
| 8  | 8C | `8C-2026-BUF8GO` | - | Semester tidak ditentukan |
| 9  | 9A | `9A-2026-WJTQ9D` | - | Semester tidak ditentukan |
| 10 | 9B | `9B-2026-TVPFXM` | - | Semester tidak ditentukan |
| 11 | 9C | `9C-2026-QFRBAW` | - | Semester tidak ditentukan |

## Cara Menggunakan

1. Buka halaman: `http://your-domain.com/kelas-login`
2. Pilih **Tahun Pelajaran**: 2025/2026 (akan terisi otomatis jika aktif)
3. Pilih **Semester**: Genap atau Ganjil (akan terisi otomatis jika aktif)
4. Pilih **Nama Kelas**: Pilih dari dropdown sesuai kelas Anda
5. Masukkan **Token Kelas**: Gunakan token dari tabel di atas
6. Isi **Captcha**: Jawab perhitungan matematika sederhana
7. Klik **Masuk ke Kelas Digital**

## Keamanan

⚠️ **PENTING**:
- Token ini bersifat rahasia dan hanya boleh dibagikan kepada siswa dalam kelas tersebut
- Jangan bagikan token secara publik atau di media sosial
- Setiap kelas memiliki token unik untuk keamanan
- Token dapat di-regenerate jika diperlukan

## Regenerate Token

Jika token perlu diubah (misalnya karena bocor), gunakan script:

```bash
cd backend
python generate_kelas_tokens.py
```

Pilih opsi 2 untuk regenerate semua token, atau opsi 1 untuk generate hanya yang belum punya.

## Catatan

- Beberapa kelas memiliki 2 entri (dengan dan tanpa semester_id) karena duplikasi data
- Untuk login, pastikan memilih kelas yang sesuai dengan semester yang dipilih
- Kelas dengan semester_id "N/A" adalah kelas tanpa semester spesifik
