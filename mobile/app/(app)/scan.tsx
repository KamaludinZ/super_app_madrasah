/**
 * Validasi kehadiran di kelas untuk jurnal mengajar — tiga cara (sama dengan web):
 *  Scan QR    : kamera membaca QR ruangan.
 *  Token Kelas: ketik token kelas XX-XXXX-XXXX → POST /jurnal/validate-by-class-token → Isi Jurnal
 *               (mode class_token → POST /jurnal/by-class-token). Perlu internet.
 *  Token QR   : tempel token QR (string panjang dari admin/QR Generator) — diproses sama dengan hasil scan.
 * QR/Token QR online : POST /jurnal/validate (QR + jadwal + GPS) → Isi Jurnal (mode qr).
 * QR/Token QR offline: pakai izin offline slot ini (disimpan saat online) dan catat bukti waktu SAAT SCAN
 *           → Isi Jurnal (mode offline) → antrean → dikirim ke /mobile/journals/offline saat online.
 * Isi QR dikirim apa adanya (terenkripsi server), tidak di-decode di aplikasi.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/endpoints';
import { errorMessage, isNetworkError } from '@/api/client';
import type { QRValidation } from '@/api/types';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { useJournalDraft } from '@/store/journalDraft';
import { computeTimeEvidence, getPermit, listPermits, StoredPermit } from '@/offline/permits';
import { getLocation } from '@/utils/location';
import { minutesOf, todayISO, wibParts } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/States';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Phase = 'scanning' | 'checking' | 'invalid' | 'pick-permit' | 'error';
type Method = 'qr' | 'qr_token' | 'class_token';

/** Format Token Kelas seperti web: huruf besar, tanda hubung otomatis → XX-XXXX-XXXX. */
function formatClassToken(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return [raw.slice(0, 2), raw.slice(2, 6), raw.slice(6, 10)].filter(Boolean).join('-');
}

/** Izin yang jamnya sedang berlangsung (toleransi 15 menit sebelum/sesudah). */
function currentPermits(permits: StoredPermit[]) {
  const p = wibParts(Date.now());
  const now = p.hour * 60 + p.minute;
  return permits.filter((x) => now >= minutesOf(x.start_time) - 15 && now <= minutesOf(x.end_time) + 15);
}

export default function ScanScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ schedule_id?: string; date?: string; method?: Method }>();
  const { user } = useAuth();
  const { online } = useNetwork();
  const draft = useJournalDraft();
  const [perm, requestPerm] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<QRValidation | null>(null);
  const [choices, setChoices] = useState<StoredPermit[]>([]);
  const [locating, setLocating] = useState(true);
  const [locError, setLocError] = useState<string | null>(null);
  const scannedRef = useRef(false);
  const [method, setMethod] = useState<Method>(params.method ?? 'qr');
  const [qrTokenText, setQrTokenText] = useState('');
  const [classToken, setClassToken] = useState('');
  // Android edge-to-edge tidak mengecilkan layar saat keyboard muncul → angkat kartu bawah setinggi keyboard.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const date = params.date || todayISO();

  useEffect(() => { draft.reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) void requestPerm(); }, [perm, requestPerm]);

  const locate = async () => {
    setLocating(true);
    const r = await getLocation();
    setLocating(false);
    setLocError(r.error ?? null);
    if (r.fix) useJournalDraft.getState().set({ location: r.fix });
    return r.fix;
  };
  useEffect(() => { void locate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const goFill = (mode: 'qr' | 'offline' | 'class_token', scheduleId: string) =>
    router.replace(`/jurnal/isi?mode=${mode}&schedule_id=${encodeURIComponent(scheduleId)}&date=${date}` as any);

  const useOfflinePermit = async () => {
    if (!user) return;
    let permit: StoredPermit | null = null;
    if (params.schedule_id) permit = await getPermit(user.id, params.schedule_id, date);
    if (!permit) {
      const own = (await listPermits(user.id, date)).filter((p) => !p.is_substitute);
      const now = currentPermits(own);
      if (now.length === 1) permit = now[0];
      else if (now.length > 1 || own.length > 0) {
        setChoices(now.length ? now : own);
        setPhase('pick-permit');
        return;
      }
    }
    if (!permit) {
      setPhase('error');
      setMessage('Izin offline untuk jadwal ini belum tersimpan. Buka aplikasi saat online minimal sekali hari ini agar bisa mengisi jurnal offline.');
      return;
    }
    choosePermit(permit);
  };

  const choosePermit = (permit: StoredPermit) => {
    useJournalDraft.getState().set({ permit, timeEvidence: computeTimeEvidence(permit) });
    goFill('offline', permit.schedule_id);
  };

  const onScanned = async (qr: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    useJournalDraft.getState().set({ qrToken: qr });
    setPhase('checking');
    const loc = useJournalDraft.getState().location ?? (await locate());
    if (!online) { await useOfflinePermit(); return; }
    try {
      const v = await api.jurnal.validate(qr, loc?.lat ?? null, loc?.lon ?? null);
      setValidation(v);
      if (v.overall_valid) {
        useJournalDraft.getState().set({ validation: v });
        const sid = v.context?.schedule?.id || params.schedule_id;
        if (sid) goFill('qr', sid);
        else { setPhase('invalid'); setMessage('Jadwal untuk QR ini tidak ditemukan.'); }
      } else {
        setPhase('invalid');
      }
    } catch (e) {
      if (isNetworkError(e)) { await useOfflinePermit(); return; }
      setPhase('error');
      setMessage(errorMessage(e, 'Gagal memvalidasi QR.'));
    }
  };

  const retry = () => { scannedRef.current = false; setValidation(null); setMessage(null); setPhase('scanning'); };

  const submitClassToken = async () => {
    const t = formatClassToken(classToken);
    if (t.length < 12) { setPhase('error'); setMessage('Token Kelas belum lengkap (format XX-XXXX-XXXX).'); return; }
    if (!online) {
      setPhase('error');
      setMessage('Token Kelas perlu koneksi internet. Saat offline gunakan Scan QR atau Token QR.');
      return;
    }
    setPhase('checking');
    setMessage(null);
    const loc = useJournalDraft.getState().location ?? (await locate());
    try {
      const v = await api.jurnal.validateByClassToken(t, loc?.lat ?? null, loc?.lon ?? null);
      setValidation(v);
      if (v.overall_valid) {
        useJournalDraft.getState().set({ classToken: t, qrToken: null, validation: v });
        const sid = v.context?.schedule?.id || params.schedule_id;
        if (sid) goFill('class_token', sid);
        else { setPhase('invalid'); setMessage('Jadwal untuk token kelas ini tidak ditemukan.'); }
      } else {
        setPhase('invalid');
      }
    } catch (e) {
      setPhase('error');
      setMessage(isNetworkError(e)
        ? 'Koneksi terputus. Token Kelas perlu internet — gunakan Scan QR atau Token QR saat offline.'
        : errorMessage(e, 'Token Kelas tidak valid.'));
    }
  };

  const changeMethod = (m: Method) => { setMethod(m); retry(); };

  if (!perm) return <LoadingState message="Menyiapkan kamera…" />;

  if (!perm.granted && method === 'qr') {
    return (
      <Screen title="Scan QR Ruangan" back>
        <Card style={{ gap: spacing.md, alignItems: 'center' }}>
          <Icon name="camera-outline" size={40} color={colors.brandPrimary} />
          <T variant="subtitle" center>Izin kamera diperlukan</T>
          <T tone="muted" center>Kamera dipakai untuk memindai QR di ruang kelas sebagai bukti kehadiran mengajar.</T>
          <Button title="Izinkan kamera" icon="camera" onPress={requestPerm} fullWidth />
          <T variant="caption" tone="muted" center>Kamera tidak bisa dipakai? Gunakan cara lain:</T>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
            <Button title="Token Kelas" icon="keypad-outline" variant="outline" onPress={() => changeMethod('class_token')} style={{ flex: 1 }} />
            <Button title="Token QR" icon="key-outline" variant="outline" onPress={() => changeMethod('qr_token')} style={{ flex: 1 }} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {phase === 'scanning' && method === 'qr' ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => { if (data) void onScanned(data); }}
        />
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton name="close" color="#FFFFFF" bg="rgba(255,255,255,0.18)" accessibilityLabel="Tutup" onPress={() => router.back()} style={styles.close} />
        <T variant="subtitle" color="#FFF" center>Validasi Kehadiran di Kelas</T>
        <T variant="caption" color="#FFF" center style={{ opacity: 0.85 }}>
          {method === 'qr'
            ? (online ? 'Arahkan kamera ke QR yang tertempel di kelas' : 'Mode offline — jurnal disimpan & dikirim saat online')
            : method === 'qr_token' ? 'Tempel token QR dari admin / QR Generator'
              : 'Ketik Token Kelas yang tertera di kartu QR kelas'}
        </T>
        <SegmentedControl<Method>
          small
          segments={[{ value: 'qr', label: 'Scan QR' }, { value: 'class_token', label: 'Token Kelas' }, { value: 'qr_token', label: 'Token QR' }]}
          value={method}
          onChange={changeMethod}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      {phase === 'scanning' && method === 'qr' ? <View style={styles.frame} pointerEvents="none" /> : null}

      <View style={[styles.bottom, { bottom: kbHeight, paddingBottom: kbHeight ? spacing.md : insets.bottom + spacing.lg }]}>
        <Card style={{ gap: spacing.sm }}>
          <View style={styles.locRow}>
            <Icon name={locating ? 'locate-outline' : locError ? 'warning-outline' : 'location'} size={18} color={locError ? colors.error : colors.brandPrimary} />
            <T variant="caption" tone={locError ? 'error' : 'secondary'} style={{ flex: 1 }}>
              {locating ? 'Membaca lokasi GPS…' : locError ?? `Lokasi didapat (akurasi ±${Math.round(draft.location?.accuracy ?? 0)} m)`}
            </T>
            {!locating && locError ? <T variant="label" tone="brand" onPress={locate}>Coba lagi</T> : null}
          </View>

          {phase === 'scanning' && method === 'qr_token' ? (
            <View style={{ gap: spacing.sm }}>
              <Input
                label="Token QR"
                icon="key-outline"
                value={qrTokenText}
                onChangeText={setQrTokenText}
                placeholder="Tempel token QR…"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                style={{ fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', fontSize: 12 }}
              />
              <Button title="Validasi token QR" icon="shield-checkmark-outline" disabled={!qrTokenText.trim()} onPress={() => onScanned(qrTokenText.trim())} />
              <T variant="caption" tone="muted">Token QR berupa string acak terenkripsi; diproses sama seperti hasil scan (bisa offline).</T>
            </View>
          ) : null}

          {phase === 'scanning' && method === 'class_token' ? (
            <View style={{ gap: spacing.sm }}>
              <Input
                label="Token Kelas"
                icon="keypad-outline"
                value={classToken}
                onChangeText={(t) => setClassToken(formatClassToken(t))}
                placeholder="XX-XXXX-XXXX"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                returnKeyType="go"
                onSubmitEditing={submitClassToken}
                style={{ fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', letterSpacing: 1.5 }}
              />
              <Button title="Validasi token kelas" icon="shield-checkmark-outline" disabled={classToken.length < 12} onPress={submitClassToken} />
              <T variant="caption" tone="muted">
                Token tertera di kartu QR kelas (admin: menu Kelas). Sistem tetap memeriksa jadwal & GPS Anda. Perlu internet.
              </T>
            </View>
          ) : null}

          {phase === 'checking' ? <T weight="semibold">{method === 'class_token' ? 'Memeriksa token kelas, jadwal, dan lokasi…' : 'Memeriksa QR, jadwal, dan lokasi…'}</T> : null}

          {phase === 'invalid' && validation ? (
            <View style={{ gap: spacing.xs }}>
              <T weight="semibold" tone="error">Jurnal belum bisa diisi</T>
              <Check ok={validation.qr.valid} text={validation.qr.reason} />
              <Check ok={validation.schedule.valid} text={validation.schedule.reason} />
              <Check ok={validation.gps.valid} text={validation.gps.reason} />
              {message ? <T variant="caption" tone="error">{message}</T> : null}
              <Button title={method === 'qr' ? 'Scan ulang' : 'Coba lagi'} icon={method === 'qr' ? 'scan' : 'refresh'} onPress={retry} />
            </View>
          ) : null}

          {phase === 'error' ? (
            <View style={{ gap: spacing.sm }}>
              <T tone="error">{message}</T>
              <Button title={method === 'qr' ? 'Scan ulang' : 'Coba lagi'} icon={method === 'qr' ? 'scan' : 'refresh'} onPress={retry} />
            </View>
          ) : null}

          {phase === 'pick-permit' ? (
            <View style={{ gap: spacing.sm }}>
              <T weight="semibold">Pilih jadwal yang sedang Anda ajar</T>
              {choices.map((p) => (
                <Button key={p.schedule_id} variant="outline" title={`${p.start_time}–${p.end_time} · ${p.class_name ?? ''} · ${p.subject_name ?? ''}`} onPress={() => choosePermit(p)} />
              ))}
            </View>
          ) : null}
        </Card>
      </View>
    </View>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  const { colors } = useTheme();
  // Server berhenti di pemeriksaan pertama yang gagal; sisanya "Belum diperiksa" → netral, bukan gagal.
  const skipped = !ok && /^belum diperiksa/i.test(text || '');
  return (
    <View style={styles.locRow}>
      <Icon name={ok ? 'checkmark-circle' : skipped ? 'ellipse-outline' : 'close-circle'} size={18}
        color={ok ? colors.success : skipped ? colors.muted : colors.error} />
      <T variant="caption" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, gap: 4, backgroundColor: 'rgba(0,0,0,0.45)', paddingBottom: spacing.md },
  close: { alignSelf: 'flex-start' },
  frame: { position: 'absolute', alignSelf: 'center', top: '30%', width: 240, height: 240, borderRadius: radius.lg, borderWidth: 3, borderColor: '#FFFFFF' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
