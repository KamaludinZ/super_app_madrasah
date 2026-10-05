import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import PilihWilayah from './PilihWilayah';
import { TINGKAT_WILAYAH, cariDesa, muatWilayah, pilihWilayahBaru } from '@/lib/wilayah';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const KOSONG = { provinsi: null, kabupaten: null, kecamatan: null, desa: null };

/**
 * Dropdown alamat bertingkat: Provinsi -> Kabupaten/Kota -> Kecamatan -> Desa/Kelurahan.
 * Pilihan tingkat bawah dikosongkan saat tingkat di atasnya berganti, dan kode pos terisi
 * otomatis dari desa/kelurahan terpilih.
 *
 * Props:
 * - value: { provinsi, kabupaten, kecamatan, desa } — masing-masing { kode, nama } atau null
 * - onChange(value, { kode_pos, kode_wilayah }) — kode_wilayah = kode tingkat terdalam yang dipilih
 * - ringkasan: teks alamat lengkap (ringkasAlamat) — ditampilkan sebagai pratinjau langsung saat mengisi,
 *   atau sebagai alamat tersimpan saat hanya-baca
 * - disabled, testidPrefix
 */
export default function WilayahBertingkat({ value = KOSONG, onChange, disabled, testidPrefix = 'wilayah', cariCepat = true, ringkasan }) {
  const [opsi, setOpsi] = useState({ provinsi: [], kabupaten: [], kecamatan: [], desa: [] });
  const [memuat, setMemuat] = useState({});
  const [tiruan, setTiruan] = useState(false);
  const [belumDimuat, setBelumDimuat] = useState({});
  const [galat, setGalat] = useState('');
  const [cari, setCari] = useState('');
  const [hasilCari, setHasilCari] = useState([]);

  // Cari cepat desa/kelurahan lewat kode pos atau nama -> isi seluruh rantai sekaligus.
  useEffect(() => {
    if (!cariCepat || cari.trim().length < 3) { setHasilCari([]); return undefined; }
    const t = setTimeout(() => {
      cariDesa(cari).then((r) => { setHasilCari(r.items); setTiruan(r.tiruan); }).catch(() => setHasilCari([]));
    }, 300);
    return () => clearTimeout(t);
  }, [cari, cariCepat]);

  const pilihHasilCari = (h) => {
    setCari('');
    setHasilCari([]);
    onChange?.(h.rantai, { kode_pos: h.kode_pos || '', kode_wilayah: h.kode });
  };
  const v = { ...KOSONG, ...value };

  const muat = async (tingkat, induk) => {
    setMemuat((m) => ({ ...m, [tingkat]: true }));
    try {
      const r = await muatWilayah(tingkat, induk);
      setOpsi((o) => ({ ...o, [tingkat]: r.items }));
      setTiruan(r.tiruan);
      setBelumDimuat((b) => ({ ...b, [tingkat]: !!r.belumDimuat }));
      setGalat('');
    } catch (e) {
      setGalat('Gagal memuat data wilayah');
    } finally {
      setMemuat((m) => ({ ...m, [tingkat]: false }));
    }
  };

  useEffect(() => { muat('provinsi', null); }, []);
  // Muat opsi tingkat bawah sesuai nilai yang sudah terpilih (mis. saat membuka data tersimpan).
  useEffect(() => { if (v.provinsi?.kode) muat('kabupaten', v.provinsi.kode); else setOpsi((o) => ({ ...o, kabupaten: [] })); }, [v.provinsi?.kode]);
  useEffect(() => { if (v.kabupaten?.kode) muat('kecamatan', v.kabupaten.kode); else setOpsi((o) => ({ ...o, kecamatan: [] })); }, [v.kabupaten?.kode]);
  useEffect(() => { if (v.kecamatan?.kode) muat('desa', v.kecamatan.kode); else setOpsi((o) => ({ ...o, desa: [] })); }, [v.kecamatan?.kode]);

  const pilih = (tingkat, kode) => {
    const item = opsi[tingkat].find((o) => o.kode === kode) || null;
    const r = pilihWilayahBaru(v, tingkat, item);
    onChange?.(r.nilai, { kode_pos: r.kode_pos, kode_wilayah: r.kode_wilayah });
  };

  const induk = { provinsi: true, kabupaten: v.provinsi, kecamatan: v.kabupaten, desa: v.kecamatan };
  const adaPilihan = TINGKAT_WILAYAH.some((t) => v[t.key]);
  const kosongkan = () => onChange?.({ ...KOSONG }, { kode_pos: '', kode_wilayah: '' });
  const hilang = []; // kode tersimpan yang tidak ada lagi di master (diisi saat render daftar)
  const tingkatBelumDimuat = TINGKAT_WILAYAH.filter((t) => belumDimuat[t.key] && induk[t.key]).map((t) => t.label);

  return (
    <div className="space-y-2" data-testid={testidPrefix}>
      {cariCepat && !disabled && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari cepat: kode pos atau nama desa/kelurahan" className="pl-9"
            data-testid={`${testidPrefix}-cari`} />
          {hasilCari.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg" data-testid={`${testidPrefix}-hasil-cari`}>
              {hasilCari.map((h) => (
                <li key={h.kode}>
                  <button type="button" onClick={() => pilihHasilCari(h)} className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-slate-50">
                    <span className="truncate">{h.nama}<span className="text-xs text-slate-500"> · {[h.rantai?.kecamatan?.nama, h.rantai?.kabupaten?.nama].filter(Boolean).join(', ')}</span></span>
                    {h.kode_pos && <span className="font-mono text-xs text-slate-500">{h.kode_pos}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TINGKAT_WILAYAH.map((t) => {
          const items = opsi[t.key];
          const terpilih = v[t.key];
          // Pilihan tersimpan dimuat ulang dari kodenya: nama resmi diambil dari master bila ada;
          // bila kodenya tidak ada di opsi, nilai tersimpan tetap ditampilkan agar tidak tampak kosong.
          const dariMaster = terpilih ? items.find((o) => o.kode === terpilih.kode) : null;
          const daftar = terpilih && !dariMaster ? [terpilih, ...items] : items;
          if (terpilih && !dariMaster && !memuat[t.key] && items.length > 0 && !tiruan) hilang.push(`${t.label} ${terpilih.nama}`);
          return (
            <div key={t.key}>
              <Label>{t.label}</Label>
              <PilihWilayah
                items={daftar}
                value={terpilih ? { ...terpilih, ...(dariMaster || {}) } : null}
                onPilih={(kode) => pilih(t.key, kode)}
                placeholder={!induk[t.key] ? `Pilih ${TINGKAT_WILAYAH[TINGKAT_WILAYAH.indexOf(t) - 1]?.label || ''} dulu` : `Pilih ${t.label}`}
                disabled={disabled || !induk[t.key] || memuat[t.key]}
                memuat={memuat[t.key]}
                kosong={induk[t.key] && !memuat[t.key] && items.length === 0
                  ? (belumDimuat[t.key] ? `Data ${t.label} belum dimuat di master wilayah` : `Belum ada data ${t.label}`) : undefined}
                tampilKodePos={t.key === 'desa'}
                testid={`${testidPrefix}-${t.key}`}
              />
            </div>
          );
        })}
      </div>
      {!disabled && adaPilihan && (
        <div className="flex justify-end">
          <button type="button" onClick={kosongkan} className="text-xs text-slate-500 underline hover:text-slate-700" data-testid={`${testidPrefix}-kosongkan`}>
            Kosongkan pilihan wilayah
          </button>
        </div>
      )}
      {hilang.length > 0 && (
        <p className="text-xs text-amber-700" data-testid={`${testidPrefix}-kode-hilang`}>
          Kode tersimpan untuk {hilang.join(', ')} tidak ditemukan di master wilayah — periksa dan pilih ulang.
        </p>
      )}
      {tingkatBelumDimuat.length > 0 && (
        <p className="text-xs text-amber-700">Data {tingkatBelumDimuat.join(', ')} untuk wilayah ini belum dimuat — minta admin mengunggah paket wilayah.</p>
      )}
      {ringkasan !== undefined && (
        <p className="rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-700" data-testid={`${testidPrefix}-ringkasan`} aria-live="polite">
          <span className="text-slate-500">{disabled ? 'Alamat tersimpan: ' : 'Pratinjau alamat lengkap: '}</span>
          {ringkasan || <span className="italic text-slate-400">belum ada isian alamat</span>}
        </p>
      )}
      {tiruan && <p className="text-xs text-amber-700">Master wilayah belum dimuat di server — menampilkan data contoh untuk mencoba alur.</p>}
      {galat && <p className="text-xs text-rose-700">{galat}</p>}
    </div>
  );
}
