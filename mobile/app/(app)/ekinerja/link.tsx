/** Tambah / ubah link bukti dukung E-Kinerja (POST/PUT /ekinerja/jurnal-harian/link): nama & URL. */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { JurnalLink } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { spacing } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { toast } from '@/components/ui/Toast';

export default function LinkForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const links = useCached<JurnalLink[]>('ekinerja.links', api.ekinerja.links, { enabled: !!id });
  const editing = id ? (links.data ?? []).find((l) => l.id === id) : undefined;
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (editing) { setLabel(editing.label); setUrl(editing.url); } }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const fail = (m: string) => { setError(m); toast.error(m); };
    if (!label.trim() || !url.trim()) return fail('Nama dan URL wajib diisi.');
    if (!/^https?:\/\//i.test(url.trim())) return fail('URL harus diawali http:// atau https://');
    setError(null);
    setBusy(true);
    try {
      const body = { label: label.trim(), url: url.trim() };
      if (id) await api.ekinerja.linkUpdate(id, body); else await api.ekinerja.linkCreate(body);
      toast.success('Link tersimpan');
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('ekinerja.') });
      router.back();
    } catch (e) {
      fail(errorMessage(e, 'Gagal menyimpan link.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={id ? 'Ubah Link Bukti' : 'Tambah Link Bukti'} back
      footer={<Button title="Simpan" icon="checkmark-circle-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} />}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <Input label="Nama link *" value={label} onChangeText={setLabel} placeholder="mis. Folder bukti Oktober" />
          <Input label="URL *" icon="link-outline" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
            placeholder="https://drive.google.com/…" hint="Atur akses Google Drive ke “siapa saja yang memiliki link” agar penilai bisa membuka." />
        </Card>
        {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
      </View>
    </Screen>
  );
}
