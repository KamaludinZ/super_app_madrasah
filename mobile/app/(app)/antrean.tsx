import React from 'react';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';

/** Sementara — dibangun pada tahap berikutnya. */
export default function Placeholder() {
  return (
    <Screen title="Antrean Jurnal" back>
      <EmptyState icon="construct-outline" title="Sedang dibangun" message="Daftar jurnal offline yang menunggu dikirim." />
    </Screen>
  );
}
