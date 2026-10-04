import React from 'react';

export function formatTanggalSurat(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr || '-';
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${Number(m[3])} ${bulan[Number(m[2]) - 1]} ${m[1]}`;
}

export const JUDUL_SURAT = {
  rujukan: 'Surat Rujukan Kesehatan',
  perizinan: 'Surat Perizinan Pulang',
};

const KODE_SURAT = { rujukan: 'RJK', perizinan: 'IZN' };
/** Jumlah baris titik-titik yang dicetak saat catatan petugas kosong. */
const BARIS_CATATAN_KOSONG = 3;

function Baris({ label, children }) {
  return (
    <>
      <div>{label}</div>
      <div className="col-span-2">: {children}</div>
    </>
  );
}

/** Jam penanganan (WIB) dari timestamp UTC `ditangani_pada`. */
export function jamPenangananWib(iso) {
  if (!iso) return null;
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return null;
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')} WIB`;
}

/** Ringkas data penatalaksanaan dari dokumen kunjungan (aman untuk data lama). */
export function ringkasPenatalaksanaan(item) {
  const utama = item?.diagnosa_utama_nama
    ? `${item.diagnosa_utama_nama}${item.diagnosa_utama_kode ? ` (${item.diagnosa_utama_kode})` : ''}`
    : null;
  const pemberian = [
    ...(item?.obat_dipakai || []).map((o) => ({ jenis: 'Obat', nama: o.obat_nama || '-', jumlah: o.jumlah })),
    ...(item?.bmhp_dipakai || []).map((b) => ({ jenis: 'BMHP', nama: b.bmhp_nama || '-', jumlah: b.jumlah })),
  ];
  return {
    utama,
    tambahan: (item?.diagnosa_tambahan_nama || []).filter(Boolean),
    jenisPenanganan: (item?.jenis_penanganan_nama || []).filter(Boolean),
    tindakan: (item?.penanganan || '').trim(),
    pemberian,
    kondisi: item?.kondisi_pulang || null,
    dirujukKe: item?.dirujuk_ke || null,
    keterangan: (item?.keterangan || '').trim(),
    jam: jamPenangananWib(item?.ditangani_pada),
    petugas: item?.ditangani_oleh || null,
    sudahDitangani: item?.status === 'Sudah Ditangani' || !!item?.ditangani_pada,
  };
}

/**
 * Isi surat keterangan UKS (rujukan / perizinan pulang) yang siap dicetak.
 * `item` = data kunjungan (termasuk penanganan), `profile` = profil pasien,
 * `settings` = pengaturan madrasah, `catatan` = catatan petugas di bawah penatalaksanaan.
 */
export default function SuratKeteranganUKS({ item, profile, settings, jenis, catatan }) {
  const sekolah = settings?.school_name || 'MTsN 2 Kota Malang';
  const kota = settings?.city || 'Malang';
  const isSiswa = profile?.jenis_pasien === 'siswa' || item?.pasien_tipe === 'siswa';
  const adaVital = ['tinggi_badan', 'berat_badan', 'tekanan_darah', 'nadi', 'suhu', 'spo2'].some((k) => item?.[k] != null && item?.[k] !== '');
  const pt = ringkasPenatalaksanaan(item);
  const catatanTeks = (catatan ?? item?.catatan_surat ?? '').trim();

  return (
    <div id="surat-uks-print" className="bg-white p-6 border border-slate-200 rounded-lg text-sm text-slate-900 space-y-4" data-testid="surat-keterangan-uks">
      <div className="text-center border-b-2 border-slate-800 pb-3 space-y-0.5">
        <div className="font-bold text-base uppercase">{sekolah}</div>
        {settings?.address && <div className="text-xs">{settings.address}</div>}
        {settings?.npsn && <div className="text-xs">NPSN: {settings.npsn}</div>}
      </div>

      <div className="text-center space-y-0.5">
        <div className="font-bold underline uppercase">{JUDUL_SURAT[jenis]}</div>
        <div className="text-xs">Nomor: UKS/{KODE_SURAT[jenis]}/{(item?.tanggal || '').replace(/-/g, '')}/{item?.id?.slice(0, 6)}</div>
      </div>

      <p>Yang bertanda tangan di bawah ini, Petugas Unit Kesehatan Sekolah (UKS) {sekolah}, menerangkan bahwa:</p>

      <div className="grid grid-cols-3 gap-x-2 gap-y-1 pl-4">
        <Baris label="Nama">{item?.pasien_nama}</Baris>
        <Baris label="NIK">{profile?.nik || '-'}</Baris>
        <Baris label="Jenis Pasien">{isSiswa ? 'Siswa' : 'GTK'}</Baris>
        {isSiswa && (
          <>
            <Baris label="Kelas">{profile?.class_name || item?.pasien_kelas || '-'}</Baris>
            <Baris label="Wali Kelas">{profile?.wali_kelas_nama || '-'}</Baris>
          </>
        )}
        <Baris label="Tanggal / Waktu">{formatTanggalSurat(item?.tanggal)} {item?.waktu || ''}</Baris>
        <Baris label="Keluhan">{item?.keluhan}</Baris>
      </div>

      {jenis === 'rujukan' ? (
        <p>
          Berdasarkan pemeriksaan yang telah dilakukan, yang bersangkutan memerlukan penanganan lebih lanjut dan
          dirujuk ke <strong>{item?.dirujuk_ke || '_______________'}</strong> untuk mendapatkan pemeriksaan/penanganan medis lebih lanjut.
        </p>
      ) : (
        <p>
          Berdasarkan pemeriksaan yang telah dilakukan, yang bersangkutan diizinkan untuk pulang lebih awal dengan
          kondisi <strong>Dijemput Orang Tua/Wali</strong> guna mendapatkan istirahat dan perawatan lebih lanjut di rumah.
        </p>
      )}

      {adaVital && (
        <div>
          <div className="mb-1 font-semibold">Hasil pemeriksaan vital:</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1 pl-4 text-xs">
            {item.tinggi_badan != null && <div>TB: {item.tinggi_badan} cm</div>}
            {item.berat_badan != null && <div>BB: {item.berat_badan} kg</div>}
            {item.tekanan_darah && <div>Tensi: {item.tekanan_darah}</div>}
            {item.nadi != null && <div>Nadi: {item.nadi} bpm</div>}
            {item.suhu != null && <div>Suhu: {item.suhu} °C</div>}
            {item.spo2 != null && <div>SpO2: {item.spo2}%</div>}
          </div>
        </div>
      )}

      <div className="surat-blok" data-testid="surat-penatalaksanaan">
        <div className="mb-1 font-semibold">Penanganan / penatalaksanaan di UKS:</div>
        {!pt.sudahDitangani ? (
          <div className="pl-4 italic text-slate-600">Belum ada data penanganan untuk kunjungan ini.</div>
        ) : (
          <div className="pl-4 space-y-2">
            <div className="grid grid-cols-3 gap-x-2 gap-y-1">
              <Baris label="Diagnosa utama">{pt.utama || '-'}</Baris>
              {pt.tambahan.length > 0 && <Baris label="Diagnosa tambahan">{pt.tambahan.join(', ')}</Baris>}
              <Baris label="Jenis penanganan">{pt.jenisPenanganan.length ? pt.jenisPenanganan.join(', ') : '-'}</Baris>
              {pt.tindakan && <Baris label="Uraian tindakan"><span className="whitespace-pre-line">{pt.tindakan}</span></Baris>}
              {pt.jam && <Baris label="Waktu penanganan">{pt.jam}</Baris>}
            </div>
            {pt.pemberian.length > 0 ? (
              <table className="w-full border-collapse text-xs" data-testid="surat-pemberian">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-400 px-2 py-1 w-8">No</th>
                    <th className="border border-slate-400 px-2 py-1 w-20">Jenis</th>
                    <th className="border border-slate-400 px-2 py-1 text-left">Obat / BMHP yang diberikan</th>
                    <th className="border border-slate-400 px-2 py-1 w-16">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {pt.pemberian.map((p, i) => (
                    <tr key={`${p.jenis}-${i}`}>
                      <td className="border border-slate-400 px-2 py-1 text-center">{i + 1}</td>
                      <td className="border border-slate-400 px-2 py-1 text-center">{p.jenis}</td>
                      <td className="border border-slate-400 px-2 py-1">{p.nama}</td>
                      <td className="border border-slate-400 px-2 py-1 text-center">{p.jumlah}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-3 gap-x-2"><Baris label="Obat / BMHP">Tidak ada pemberian obat/BMHP</Baris></div>
            )}
            <div className="grid grid-cols-3 gap-x-2 gap-y-1">
              <Baris label="Kondisi saat keluar UKS">{pt.kondisi || '-'}{pt.dirujukKe ? ` — ke ${pt.dirujukKe}` : ''}</Baris>
              {pt.keterangan && <Baris label="Keterangan"><span className="whitespace-pre-line">{pt.keterangan}</span></Baris>}
            </div>
          </div>
        )}
      </div>

      <div className="surat-blok" data-testid="surat-catatan">
        <div className="mb-1 font-semibold">Catatan:</div>
        {catatanTeks ? (
          <div className="pl-4 whitespace-pre-line border-l-2 border-slate-300 min-h-[3rem]">{catatanTeks}</div>
        ) : (
          <div className="pl-4" data-testid="surat-catatan-kosong">
            <div className="text-xs italic text-slate-400 print:hidden">Belum ada catatan — tersedia baris kosong untuk ditulis tangan.</div>
            {Array.from({ length: BARIS_CATATAN_KOSONG }, (_, i) => (
              <div key={i} className="h-7 border-b border-dotted border-slate-500" aria-hidden="true" />
            ))}
          </div>
        )}
      </div>

      <p>Demikian surat ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>

      <div className="surat-blok flex justify-between pt-2">
        {isSiswa ? (
          <div className="text-center">
            <div className="invisible">{kota}, {formatTanggalSurat(item?.tanggal)}</div>
            <div>Mengetahui, Wali Kelas</div>
            <div className="h-16"></div>
            <div className="font-semibold underline">{profile?.wali_kelas_nama || '(_________________)'}</div>
          </div>
        ) : <div />}
        <div className="text-center">
          <div>{kota}, {formatTanggalSurat(item?.tanggal)}</div>
          <div>Petugas UKS,</div>
          <div className="h-16"></div>
          <div className="font-semibold underline">{item?.ditangani_oleh || item?.petugas_nama || '(_________________)'}</div>
        </div>
      </div>
    </div>
  );
}
