/**
 * Menu Lab (native) — rute sama dengan web /lab/{lab}/{menu} untuk guru IPA/IPS/Bahasa/Seni/Agama/TIK:
 * alat-bahan, jadwal, jurnal-penggunaan, jurnal-pengelolaan, peminjaman-alat, kerusakan (isi di src/lab/screens).
 */
import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useNetwork } from '@/store/network';
import { LAB_NAMA, MENU_LAB } from '@/lab/api';
import {
  AlatBahanScreen, JadwalScreen, JurnalPengelolaanScreen, JurnalPenggunaanScreen, KerusakanScreen, PeminjamanScreen,
} from '@/lab/screens';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';

const TOMBOL: Record<string, string> = {
  'alat-bahan': 'Tambah alat/bahan', jadwal: 'Tambah jadwal', 'jurnal-penggunaan': 'Isi jurnal penggunaan',
  'jurnal-pengelolaan': 'Isi jurnal pengelolaan', 'peminjaman-alat': 'Catat peminjaman', kerusakan: 'Laporkan kerusakan',
};

export default function MenuLab() {
  const p = useLocalSearchParams<{ lab: string; menu: string }>();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const [tambah, setTambah] = useState(false);
  const [segar, setSegar] = useState(false);
  const lab = p.lab ?? '';
  const menu = p.menu ?? '';
  const props = { lab, tambah, setTambah };
  const isi = menu === 'alat-bahan' ? <AlatBahanScreen {...props} /> : menu === 'jadwal' ? <JadwalScreen {...props} />
    : menu === 'jurnal-penggunaan' ? <JurnalPenggunaanScreen {...props} /> : menu === 'jurnal-pengelolaan' ? <JurnalPengelolaanScreen {...props} />
      : menu === 'peminjaman-alat' ? <PeminjamanScreen {...props} /> : menu === 'kerusakan' ? <KerusakanScreen {...props} /> : null;

  return (
    <Screen title={MENU_LAB[menu] ?? 'Lab'} subtitle={LAB_NAMA[lab] ?? lab} back refreshing={segar}
      onRefresh={async () => { setSegar(true); await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(`lab.${lab}.`) }); setSegar(false); }}
      footer={isi && TOMBOL[menu] ? <Button title={TOMBOL[menu]} icon="add-circle-outline" disabled={!online} onPress={() => setTambah(true)} /> : undefined}>
      {isi ?? <Card><EmptyState icon="flask-outline" title="Menu lab tidak dikenal" compact /></Card>}
    </Screen>
  );
}
