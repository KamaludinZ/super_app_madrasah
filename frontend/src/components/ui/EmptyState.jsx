import React from 'react';
import { Button } from '@/components/ui/button';
import { MosqueDome, QuranIcon, TasbihIcon, LanternIcon } from '@/components/patterns/IslamicPatterns';

/**
 * Empty State Component
 * Shows when no data is available with helpful Islamic-themed illustrations
 */
export function EmptyState({
  illustration = 'mosque',
  title,
  description,
  action,
  actionLabel,
  onAction,
  size = 'md',
}) {
  const illustrations = {
    mosque: <MosqueDome className="w-32 h-32 mx-auto" />,
    quran: <QuranIcon className="w-32 h-32 mx-auto" />,
    tasbih: <TasbihIcon className="w-32 h-32 mx-auto" />,
    lantern: <LanternIcon className="w-32 h-32 mx-auto" />,
  };

  const sizes = {
    sm: {
      container: 'py-8',
      illustration: 'w-24 h-24',
      title: 'text-base',
      description: 'text-sm',
    },
    md: {
      container: 'py-12',
      illustration: 'w-32 h-32',
      title: 'text-lg',
      description: 'text-base',
    },
    lg: {
      container: 'py-16',
      illustration: 'w-40 h-40',
      title: 'text-xl',
      description: 'text-lg',
    },
  };

  const sizeConfig = sizes[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeConfig.container}`}>
      <div className={`${sizeConfig.illustration} mb-6 opacity-60`}>
        {illustrations[illustration]}
      </div>

      {title && (
        <h3 className={`${sizeConfig.title} font-semibold text-slate-900 mb-2`}>
          {title}
        </h3>
      )}

      {description && (
        <p className={`${sizeConfig.description} text-slate-600 max-w-md mb-6`}>
          {description}
        </p>
      )}

      {(action || (onAction && actionLabel)) && (
        <div>
          {action || (
            <Button onClick={onAction} className="bg-[#006837] hover:bg-[#0B7A3B]">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured Empty State Variants
 * Ready-to-use for common scenarios
 */

export function NoDataEmptyState({ onAction, actionLabel = 'Tambah Data' }) {
  return (
    <EmptyState
      illustration="mosque"
      title="Belum Ada Data"
      description="Data belum tersedia. Mulai dengan menambahkan data pertama."
      onAction={onAction}
      actionLabel={actionLabel}
    />
  );
}

export function NoJurnalEmptyState({ onAction }) {
  return (
    <EmptyState
      illustration="quran"
      title="Belum Ada Jurnal Hari Ini"
      description="Mulai mengisi jurnal mengajar dengan scan QR kode kelas atau input manual."
      onAction={onAction}
      actionLabel="Scan QR Jurnal"
    />
  );
}

export function NoStudentsEmptyState({ onAction }) {
  return (
    <EmptyState
      illustration="mosque"
      title="Belum Ada Siswa"
      description="Kelas ini belum memiliki siswa. Tambahkan siswa untuk memulai."
      onAction={onAction}
      actionLabel="Tambah Siswa"
    />
  );
}

export function NoMateriEmptyState({ onAction }) {
  return (
    <EmptyState
      illustration="quran"
      title="Belum Ada Materi"
      description="Belum ada materi pembelajaran yang dibagikan. Upload materi pertama Anda."
      onAction={onAction}
      actionLabel="Upload Materi"
    />
  );
}

export function NoTugasEmptyState({ onAction }) {
  return (
    <EmptyState
      illustration="quran"
      title="Belum Ada Tugas"
      description="Tidak ada tugas yang tersedia saat ini. Cek kembali nanti."
      size="sm"
    />
  );
}

export function NoPrestasiEmptyState({ onAction }) {
  return (
    <EmptyState
      illustration="lantern"
      title="Belum Ada Prestasi"
      description="Prestasi yang diraih akan tampil di sini. Terus semangat berprestasi!"
      onAction={onAction}
      actionLabel="Tambah Prestasi"
    />
  );
}

export function NoNotificationsEmptyState() {
  return (
    <EmptyState
      illustration="tasbih"
      title="Tidak Ada Notifikasi"
      description="Semua notifikasi sudah dibaca. Anda sudah update dengan semua informasi."
      size="sm"
    />
  );
}

export function NoSearchResultsEmptyState({ query }) {
  return (
    <EmptyState
      illustration="mosque"
      title="Tidak Ditemukan"
      description={`Tidak ada hasil untuk pencarian "${query}". Coba kata kunci lain.`}
      size="sm"
    />
  );
}

export function ErrorEmptyState({ onRetry }) {
  return (
    <EmptyState
      illustration="mosque"
      title="Terjadi Kesalahan"
      description="Maaf, terjadi kesalahan saat memuat data. Silakan coba lagi."
      onAction={onRetry}
      actionLabel="Coba Lagi"
    />
  );
}

export function UnauthorizedEmptyState() {
  return (
    <EmptyState
      illustration="mosque"
      title="Akses Terbatas"
      description="Anda tidak memiliki akses ke halaman ini. Hubungi admin untuk informasi lebih lanjut."
      size="md"
    />
  );
}

export function MaintenanceEmptyState() {
  return (
    <EmptyState
      illustration="mosque"
      title="Sedang Pemeliharaan"
      description="Fitur ini sedang dalam pemeliharaan. Mohon cek kembali beberapa saat lagi."
      size="md"
    />
  );
}

/**
 * Loading Empty State
 * For when data is being fetched but we want a nicer message than spinner
 */
export function LoadingEmptyState({ message = 'Memuat data...' }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="w-32 h-32 mb-6 opacity-60 animate-pulse">
        <MosqueDome className="w-full h-full" />
      </div>
      <p className="text-base text-slate-600">{message}</p>
    </div>
  );
}
