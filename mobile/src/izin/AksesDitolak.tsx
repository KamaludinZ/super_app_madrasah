/** Layar akses ditolak untuk layar izin yang dibatasi peran (ditampilkan, bukan dialihkan diam-diam). */
import React from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { roleLabel } from '@/utils/roles';

export function AksesDitolak({ judul, untuk, peranBerhak = [] }: { judul: string; untuk: string; peranBerhak?: string[] }) {
  const router = useRouter();
  const { user, activeRole } = useAuth();
  const punya = (user?.roles ?? []).filter((r) => peranBerhak.includes(r) && r !== activeRole);
  const saran = punya.length ? ` Anda juga memiliki peran ${punya.map(roleLabel).join(', ')} — ganti peran di tab Profil.` : '';
  return (
    <Screen title={judul} back>
      <Card>
        <EmptyState
          icon="lock-closed-outline"
          title="Akses ditolak"
          message={`Layar ini hanya untuk ${untuk}. Peran aktif Anda: ${roleLabel(activeRole)}.${saran}`}
          actionLabel="Kembali ke Beranda"
          onAction={() => router.replace('/(app)/(tabs)' as any)}
        />
      </Card>
    </Screen>
  );
}
