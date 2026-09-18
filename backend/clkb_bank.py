"""Item bank for Check List Kebiasaan Belajar (CLKB) — 56 statements.

Each statement has a pre-defined answer key of '+' (positive/good habit) or
'-' (negative/needs improvement), taken from the paper-based "Lembar Jawaban"
key. A student selects ("melingkari") any statements that match their own
situation; scoring counts how many selected items are '+' vs '-'.
"""

CLKB_ITEMS = [
    {'no': 1, 'pernyataan': 'Saya mempunyai waktu yang cukup untuk belajar di rumah.', 'kunci': '+'},
    {'no': 2, 'pernyataan': 'Di rumah saya tidak punya waktu yang cukup untuk belajar.', 'kunci': '-'},
    {'no': 3, 'pernyataan': 'Saya belajar setiap hari secara teratur.', 'kunci': '+'},
    {'no': 4, 'pernyataan': 'Saya hanya belajar jika ada ulangan.', 'kunci': '-'},
    {'no': 5, 'pernyataan': 'Waktu luang yang saya miliki habis untuk membantu orang tua di rumah.', 'kunci': '-'},
    {'no': 6, 'pernyataan': 'Saya mempunyai daftar pembagian waktu untuk belajar.', 'kunci': '+'},
    {'no': 7, 'pernyataan': 'Saya tidak mempunyai daftar pembagian waktu untuk belajar.', 'kunci': '-'},
    {'no': 8, 'pernyataan': 'Saya mempunyai ruangan khusus untuk belajar.', 'kunci': '+'},
    {'no': 9, 'pernyataan': 'Saya mempunyai kelompok belajar bersama di rumah.', 'kunci': '+'},
    {'no': 10, 'pernyataan': 'Lampu ruang belajar di rumah cukup memenuhi untuk belajar.', 'kunci': '+'},
    {'no': 11, 'pernyataan': 'Adik-adik sering mengganggu belajar saya.', 'kunci': '-'},
    {'no': 12, 'pernyataan': 'Teman-teman saya sering mengganggu saya waktu belajar.', 'kunci': '-'},
    {'no': 13, 'pernyataan': 'Suara bising di luar sering mengganggu belajar saya.', 'kunci': '-'},
    {'no': 14, 'pernyataan': 'Saya biasa tidur siang.', 'kunci': '+'},
    {'no': 15, 'pernyataan': 'Saya tidak biasa tidur siang.', 'kunci': '-'},
    {'no': 16, 'pernyataan': 'Di rumah saya mempunyai kegiatan olah raga, organisasi atau kegiatan lain selain membantu orang tua.', 'kunci': '+'},
    {'no': 17, 'pernyataan': 'Biasanya bahan-bahan belajar yang sulit saya pelajari terlebih dahulu, baru kemudian bahan yang lebih ringan.', 'kunci': '+'},
    {'no': 18, 'pernyataan': 'Saya tidak merencanakan bahan apa yang harus saya pelajari.', 'kunci': '-'},
    {'no': 19, 'pernyataan': 'Saya merasa kurang cocok dengan studi/gugus/jurusan/peminatan yang saya pilih.', 'kunci': '-'},
    {'no': 20, 'pernyataan': 'Saya sudah merasa cocok dengan studi/gugus/jurusan/peminatan yang saya pilih.', 'kunci': '+'},
    {'no': 21, 'pernyataan': 'Orang tua saya merencanakan bidang studi yang saya pilih/saya ambil.', 'kunci': '-'},
    {'no': 22, 'pernyataan': 'Saya bersama orang tua merencanakan bidang studi yang saya pilih/saya ambil.', 'kunci': '+'},
    {'no': 23, 'pernyataan': 'Saya menentukan sendiri bidang studi yang saya pilih/saya ambil.', 'kunci': '+'},
    {'no': 24, 'pernyataan': 'Ada beberapa pelajaran yang sulit saya ikuti.', 'kunci': '-'},
    {'no': 25, 'pernyataan': 'Saya dapat mengikuti sistem pendidikan (kurikulum) di sekolah ini.', 'kunci': '+'},
    {'no': 26, 'pernyataan': 'Saya sulit mengikuti sistem pendidikan di sekolah ini.', 'kunci': '-'},
    {'no': 27, 'pernyataan': 'Saya tidak mengerti tentang sistem pendidikan di sekolah ini.', 'kunci': '-'},
    {'no': 28, 'pernyataan': 'Alat-alat belajar saya selalu tidak mencukupi dan tidak terbeli.', 'kunci': '-'},
    {'no': 29, 'pernyataan': 'Uang SPP selalu mengganggu belajar saya.', 'kunci': '-'},
    {'no': 30, 'pernyataan': 'Alat-alat pelajaran di sekolah sangat membantu belajar saya.', 'kunci': '+'},
    {'no': 31, 'pernyataan': 'Orang tua/wali saya selalu memperhatikan penggunaan waktu belajar di rumah.', 'kunci': '+'},
    {'no': 32, 'pernyataan': 'Orang tua/wali saya kadang-kadang memperhatikan penggunaan waktu belajar saya di rumah.', 'kunci': '+'},
    {'no': 33, 'pernyataan': 'Orang tua/wali saya tidak pernah memperhatikan penggunaan waktu belajar saya di rumah.', 'kunci': '-'},
    {'no': 34, 'pernyataan': 'Saya belajar hanya jika mendapat teguran dari orang tua saja.', 'kunci': '-'},
    {'no': 35, 'pernyataan': 'Saya belajar karena dorongan dan keinginan saya sendiri.', 'kunci': '+'},
    {'no': 36, 'pernyataan': 'Saya belajar karena terdorong oleh teman.', 'kunci': '+'},
    {'no': 37, 'pernyataan': 'Saya tidak mengetahui manfaat pelajaran yang saya ikuti.', 'kunci': '-'},
    {'no': 38, 'pernyataan': 'Saya kurang jelas apa manfaat beberapa pelajaran yang saya ikuti.', 'kunci': '-'},
    {'no': 39, 'pernyataan': 'Buku-buku pelajaran saya kurang lengkap.', 'kunci': '-'},
    {'no': 40, 'pernyataan': 'Buku-buku pelajaran saya cukup lengkap.', 'kunci': '+'},
    {'no': 41, 'pernyataan': 'Buku catatan pelajaran saya cukup lengkap.', 'kunci': '+'},
    {'no': 42, 'pernyataan': 'Buku catatan pelajaran saya kurang lengkap.', 'kunci': '-'},
    {'no': 43, 'pernyataan': 'Saya tidak begitu berminat dengan buku-buku pelajaran.', 'kunci': '-'},
    {'no': 44, 'pernyataan': 'Saya sulit memahami buku-buku pelajaran.', 'kunci': '-'},
    {'no': 45, 'pernyataan': 'Saya sering membaca buku di perpustakaan.', 'kunci': '+'},
    {'no': 46, 'pernyataan': 'Saya kadang-kadang membaca buku di perpustakaan.', 'kunci': '+'},
    {'no': 47, 'pernyataan': 'Saya jarang membaca buku di perpustakaan.', 'kunci': '+'},
    {'no': 48, 'pernyataan': 'Saya tidak pernah membaca buku di perpustakaan.', 'kunci': '-'},
    {'no': 49, 'pernyataan': 'Saya sering bertanya kepada Bapak/Ibu guru tentang pelajaran.', 'kunci': '+'},
    {'no': 50, 'pernyataan': 'Saya kadang-kadang bertanya kepada Bapak/Ibu guru tentang pelajaran.', 'kunci': '+'},
    {'no': 51, 'pernyataan': 'Saya jarang bertanya kepada Bapak/Ibu guru tentang pelajaran.', 'kunci': '+'},
    {'no': 52, 'pernyataan': 'Saya tidak pernah bertanya kepada Bapak/Ibu guru tentang pelajaran.', 'kunci': '-'},
    {'no': 53, 'pernyataan': 'Saya kadang-kadang bertanya kepada teman-teman tentang pelajaran.', 'kunci': '+'},
    {'no': 54, 'pernyataan': 'Saya sering bertanya kepada teman-teman tentang pelajaran.', 'kunci': '+'},
    {'no': 55, 'pernyataan': 'Saya jarang sekali bertanya kepada teman-teman tentang pelajaran.', 'kunci': '-'},
    {'no': 56, 'pernyataan': 'Di rumah ada yang membantu saya dalam soal pelajaran.', 'kunci': '+'},
]

CLKB_PETUNJUK = [
    'Bacalah pernyataan-pernyataan di bawah ini dengan teliti.',
    'Pilihlah (centang) pernyataan yang sesuai dengan keadaan dirimu.',
    'Jawabanmu tidak akan berpengaruh pada nilai. Tidak ada benar dan salah dalam mengisi check list ini. Kerjakan dengan jujur, agar hasilnya dapat membantu meningkatkan cara belajar yang baik.',
    'Selamat mengerjakan.',
]

CLKB_TOTAL_ITEMS = len(CLKB_ITEMS)
