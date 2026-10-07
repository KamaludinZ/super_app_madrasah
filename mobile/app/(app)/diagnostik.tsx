import React from 'react';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';

/** Sementara — dibangun pada tahap berikutnya. */
export default function Placeholder() {
  return (
    <Screen title="Tentang & Diagnostik" back>
      <EmptyState icon="construct-outline" title="Sedang dibangun" message="Status notifikasi, koneksi, dan sinkron." />
    </Screen>
  );
}
