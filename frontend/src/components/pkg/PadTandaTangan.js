import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, PenLine } from 'lucide-react';

const TINTA = '#0f172a';
const TEBAL = 2.4; // px CSS
const LEBAR_EKSPOR_MAKS = 1200;

// Gambar ulang semua goresan (titik ternormalisasi 0–1) pada konteks berukuran lebar x tinggi.
function gambar(ctx, goresan, lebar, tinggi, skala) {
  ctx.clearRect(0, 0, lebar * skala, tinggi * skala);
  ctx.save();
  ctx.scale(skala, skala);
  ctx.strokeStyle = TINTA;
  ctx.fillStyle = TINTA;
  ctx.lineWidth = TEBAL;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  goresan.forEach((titik) => {
    const p = titik.map(([x, y]) => [x * lebar, y * tinggi]);
    if (p.length === 1) {
      ctx.beginPath();
      ctx.arc(p[0][0], p[0][1], TEBAL / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i += 1) {
      const tengahX = (p[i][0] + p[i + 1][0]) / 2;
      const tengahY = (p[i][1] + p[i + 1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0], p[i][1], tengahX, tengahY);
    }
    const akhir = p[p.length - 1];
    ctx.lineTo(akhir[0], akhir[1]);
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Kolom tanda tangan bebas coret (jari, stylus, atau mouse) memakai Pointer Events. Goresan disimpan ternormalisasi
 * sehingga tetap utuh saat ukuran layar berubah. `onUbah(dataUrl | null)` dipanggil setiap goresan selesai / dihapus;
 * dataUrl = PNG berlatar transparan (lebar maks. 1200 px). Ref: { hapus() }.
 */
const PadTandaTangan = forwardRef(function PadTandaTangan({ onUbah, disabled = false, invalid = false }, ref) {
  const wadahRef = useRef(null);
  const kanvasRef = useRef(null);
  const goresanRef = useRef([]);
  const aktifRef = useRef(null); // { pointerId, titik }
  const [kosong, setKosong] = useState(true);

  const ukuran = () => {
    const el = wadahRef.current;
    return el ? { lebar: el.clientWidth, tinggi: el.clientHeight } : { lebar: 0, tinggi: 0 };
  };

  const render = useCallback(() => {
    const kanvas = kanvasRef.current;
    if (!kanvas) return;
    const { lebar, tinggi } = ukuran();
    const dpr = window.devicePixelRatio || 1;
    if (kanvas.width !== Math.round(lebar * dpr) || kanvas.height !== Math.round(tinggi * dpr)) {
      kanvas.width = Math.round(lebar * dpr);
      kanvas.height = Math.round(tinggi * dpr);
    }
    const semua = aktifRef.current ? [...goresanRef.current, aktifRef.current.titik] : goresanRef.current;
    gambar(kanvas.getContext('2d'), semua, lebar, tinggi, dpr);
  }, []);

  useEffect(() => {
    render();
    const amati = new ResizeObserver(() => render());
    if (wadahRef.current) amati.observe(wadahRef.current);
    return () => amati.disconnect();
  }, [render]);

  const ekspor = () => {
    const { lebar, tinggi } = ukuran();
    const skala = Math.min(2, LEBAR_EKSPOR_MAKS / Math.max(lebar, 1));
    const c = document.createElement('canvas');
    c.width = Math.round(lebar * skala);
    c.height = Math.round(tinggi * skala);
    gambar(c.getContext('2d'), goresanRef.current, lebar, tinggi, skala);
    return c.toDataURL('image/png');
  };

  const hapus = () => {
    goresanRef.current = [];
    aktifRef.current = null;
    setKosong(true);
    render();
    onUbah?.(null);
  };
  useImperativeHandle(ref, () => ({ hapus }));

  const titikDari = (e) => {
    const kotak = kanvasRef.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - kotak.left) / kotak.width)), Math.min(1, Math.max(0, (e.clientY - kotak.top) / kotak.height))];
  };
  const mulai = (e) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    kanvasRef.current.setPointerCapture?.(e.pointerId);
    aktifRef.current = { pointerId: e.pointerId, titik: [titikDari(e)] };
    render();
  };
  const gerak = (e) => {
    const aktif = aktifRef.current;
    if (!aktif || aktif.pointerId !== e.pointerId) return;
    e.preventDefault();
    const peristiwa = e.nativeEvent.getCoalescedEvents?.() || [e];
    peristiwa.forEach((p) => aktif.titik.push(titikDari(p)));
    render();
  };
  const selesai = (e) => {
    const aktif = aktifRef.current;
    if (!aktif || aktif.pointerId !== e.pointerId) return;
    goresanRef.current = [...goresanRef.current, aktif.titik];
    aktifRef.current = null;
    setKosong(false);
    render();
    onUbah?.(ekspor());
  };

  return (
    <div className="space-y-2">
      <div ref={wadahRef}
        className={`relative h-44 w-full overflow-hidden rounded-xl border-2 border-dashed bg-white sm:h-52 ${
          invalid ? 'border-rose-300' : 'border-slate-300'} ${disabled ? 'opacity-60' : ''}`}>
        <canvas ref={kanvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none select-none"
          onPointerDown={mulai} onPointerMove={gerak} onPointerUp={selesai} onPointerCancel={selesai}
          role="img" aria-label="Kolom tanda tangan: goreskan tanda tangan Anda dengan jari, stylus, atau mouse"
          data-testid="pad-tanda-tangan" />
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-slate-200" aria-hidden="true" />
        {kosong && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400" aria-hidden="true">
            <PenLine className="h-6 w-6" />
            <span className="text-sm">Goreskan tanda tangan di sini</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{kosong ? 'Belum ada tanda tangan.' : 'Tanda tangan tersimpan di formulir.'}</span>
        <Button type="button" variant="ghost" size="sm" onClick={hapus} disabled={kosong || disabled} className="gap-1 text-slate-600">
          <Eraser className="h-4 w-4" /> Ulangi
        </Button>
      </div>
    </div>
  );
});

export default PadTandaTangan;
