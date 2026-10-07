import React from 'react';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';

/** Sementara — dibangun pada tahap berikutnya. */
export default function Placeholder() {
  return (
    <Screen title="Beranda" headerTone="brand">
      <EmptyState icon="construct-outline" title="Sedang dibangun" message="Jadwal hari ini, slot guru pengganti, dan pintasan isi jurnal." />
    </Screen>
  );
}
