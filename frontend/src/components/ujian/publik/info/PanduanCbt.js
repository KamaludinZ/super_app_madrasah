import React, { useState } from 'react';
import { ExternalLink, FileText, MonitorPlay, PlayCircle } from 'lucide-react';
import { bukaPanduanContoh, idVideoYoutube, urlPanduanCbt, urlVideoAman } from '@/lib/ujianInfoPublik';
import { BagianInfo, KosongInfo } from './BagianInfo';

const kelasTombol = 'flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]';

function IsiTombol({ Ikon, judul, sub }) {
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#006837]"><Ikon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{judul}</span>
        <span className="block truncate text-xs text-slate-500">{sub}</span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </>
  );
}

/**
 * Pemutar YouTube "klik untuk memuat": iframe (youtube-nocookie) baru dipasang setelah siswa menekan putar, sehingga
 * halaman tidak memuat apa pun dari pihak ketiga dan tidak menghabiskan kuota sebelum diminta.
 */
function PemutarYoutube({ id }) {
  const [putar, setPutar] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900" data-testid="panduan-video-sematan">
      <div className="relative aspect-video">
        {putar ? (
          <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title="Video panduan CBT" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin" data-testid="panduan-video-iframe" />
        ) : (
          <button type="button" onClick={() => setPutar(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300"
            data-testid="panduan-video-putar">
            <PlayCircle className="h-14 w-14 text-white/90" aria-hidden="true" />
            <span className="text-sm font-semibold">Putar video panduan di sini</span>
            <span className="text-xs text-slate-300">Memakai kuota internet · YouTube</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Panduan CBT: berkas PDF (dibuka di tab baru) dan/atau video panduan. Video YouTube dapat diputar di halaman ini
 * (klik untuk memuat); tautan video lain dibuka di tab baru. Hanya tautan http(s) yang ditampilkan.
 * `onBukaPdf` opsional menggantikan tautan publik PDF (pratinjau admin di menu Info Ujian, tanpa token).
 */
export default function PanduanCbt({ token, panduan, tiruan, onBukaPdf }) {
  const adaPdf = !!panduan?.ada_pdf;
  const video = urlVideoAman(panduan?.video_url);
  const idYoutube = idVideoYoutube(video);
  const namaPdf = panduan?.nama_file || 'Panduan CBT.pdf';
  return (
    <BagianInfo id="panduan-cbt" Ikon={MonitorPlay} judul="Panduan CBT" keterangan={panduan?.keterangan || 'Cara memakai aplikasi ujian berbasis komputer.'}>
      {!adaPdf && !video ? (
        <KosongInfo Ikon={MonitorPlay} judul="Panduan CBT belum tersedia" testId="panduan-kosong">
          Panitia akan membagikan panduan sebelum ujian. Tanyakan kepada proktor atau wali kelas bila ada kendala aplikasi.
        </KosongInfo>
      ) : (
        <div className="space-y-2">
          {idYoutube && <PemutarYoutube id={idYoutube} />}
          <div className={`grid grid-cols-1 gap-2 ${adaPdf && video ? 'sm:grid-cols-2 lg:grid-cols-1' : ''}`}>
            {adaPdf && (tiruan || onBukaPdf ? (
              <button type="button" onClick={onBukaPdf || bukaPanduanContoh} className={kelasTombol} data-testid="panduan-pdf">
                <IsiTombol Ikon={FileText} judul="Buka panduan (PDF)" sub={namaPdf} />
              </button>
            ) : (
              <a href={urlPanduanCbt(token)} target="_blank" rel="noopener noreferrer" className={kelasTombol} data-testid="panduan-pdf">
                <IsiTombol Ikon={FileText} judul="Buka panduan (PDF)" sub={namaPdf} />
              </a>
            ))}
            {video && (
              <a href={video} target="_blank" rel="noopener noreferrer" className={kelasTombol} data-testid="panduan-video">
                <IsiTombol Ikon={PlayCircle} judul={idYoutube ? 'Buka di YouTube' : 'Tonton video panduan'} sub={video.replace(/^https?:\/\/(www\.)?/, '')} />
              </a>
            )}
          </div>
        </div>
      )}
    </BagianInfo>
  );
}
