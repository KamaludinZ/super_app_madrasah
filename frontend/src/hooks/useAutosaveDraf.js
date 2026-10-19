import { useCallback, useEffect, useRef, useState } from 'react';

// Simpan otomatis draf setelah `jeda` ms tanpa perubahan. `data` = nilai yang disimpan (dibandingkan via JSON);
// `simpan(data)` mengembalikan Promise berisi { updated_at }. Perubahan pertama (pemuatan awal) tidak disimpan.
// Status: 'diam' | 'menunggu' | 'menyimpan' | 'tersimpan' | 'gagal' (+ pesanGalat dari server). Saat ada perubahan belum tersimpan,
// browser memperingatkan pengguna sebelum menutup/meninggalkan halaman.
export default function useAutosaveDraf({ data, simpan, aktif = true, jeda = 2000, tersimpanAwal = null }) {
  const [status, setStatus] = useState('diam');
  const [tersimpanPada, setTersimpanPada] = useState(tersimpanAwal);
  const [pesanGalat, setPesanGalat] = useState(null);
  const terakhir = useRef(null); // JSON data yang terakhir tersimpan / dimuat
  const timer = useRef(null);
  const jsonData = JSON.stringify(data);
  const belumTersimpan = aktif && terakhir.current !== null && terakhir.current !== jsonData;

  // Waktu simpan dari server tersedia setelah data dimuat (setelah render pertama).
  useEffect(() => {
    if (tersimpanAwal) setTersimpanPada((t) => t || tersimpanAwal);
  }, [tersimpanAwal]);

  const simpanSekarang = useCallback(async () => {
    clearTimeout(timer.current);
    const kirim = jsonData;
    setStatus('menyimpan');
    setPesanGalat(null);
    try {
      const hasil = await simpan(JSON.parse(kirim));
      terakhir.current = kirim;
      setTersimpanPada(hasil?.updated_at || new Date().toISOString());
      setStatus('tersimpan');
      return hasil;
    } catch (e) {
      setStatus('gagal');
      setPesanGalat(e?.message || null);
      throw e;
    }
  }, [jsonData, simpan]);

  useEffect(() => {
    if (!aktif) return undefined;
    if (terakhir.current === null) {
      terakhir.current = jsonData; // data awal dari server, bukan perubahan
      return undefined;
    }
    if (terakhir.current === jsonData) return undefined;
    setStatus('menunggu');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { simpanSekarang().catch(() => {}); }, jeda);
    return () => clearTimeout(timer.current);
  }, [aktif, jsonData, jeda, simpanSekarang]);

  useEffect(() => {
    if (!belumTersimpan) return undefined;
    const peringatan = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', peringatan);
    return () => window.removeEventListener('beforeunload', peringatan);
  }, [belumTersimpan]);

  return { status, tersimpanPada, pesanGalat, belumTersimpan, simpanSekarang };
}
