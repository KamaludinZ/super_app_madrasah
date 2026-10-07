/**
 * Modul web di dalam aplikasi: membuka halaman web madrasah (semua fitur per peran) dalam
 * keadaan sudah masuk, tanpa sidebar/topbar web (mode tertanam). Parameter: `path` (mis.
 * /admin/siswa) dan `title`. Unduhan (PDF/Excel/rapor) disimpan lalu dibagikan lewat lembar
 * berbagi Android; tautan luar & cetak dibuka di browser. Tombol kembali Android menelusuri
 * riwayat halaman web lebih dulu.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { WEB_URL } from '@/config';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { buildBridgeScript, BridgeMessage } from '@/web/bridge';
import { spacing, useTheme } from '@/theme';
import { T } from '@/components/ui/Text';
import { IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

const WEB_HOST = WEB_URL.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const safeName = (n: string) => n.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || `unduhan-${Date.now()}`;

export default function WebModuleScreen() {
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token, user, activeRole } = useAuth();
  const { online } = useNetwork();
  const ref = useRef<WebView>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [title, setTitle] = useState(params.title || 'Super Apps');
  const [failed, setFailed] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const reloginTried = useRef(false);

  const path = (params.path || '/dashboard').startsWith('/') ? params.path || '/dashboard' : `/${params.path}`;
  const startUrl = `${WEB_URL}${path}`;
  const script = useMemo(() => buildBridgeScript({ host: WEB_HOST, token, user, activeRole }), [token, user, activeRole]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { ref.current?.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNav = (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCurrentUrl(nav.url);
    // Sesi web habis → web mengarah ke /login: suntik ulang sesi aplikasi sekali, lalu muat ulang.
    if (/\/login(\?|$)/.test(nav.url.replace(WEB_URL, '')) && !nav.loading) {
      if (!reloginTried.current && token) {
        reloginTried.current = true;
        ref.current?.injectJavaScript(`${script}; location.replace(${JSON.stringify(startUrl)}); true;`);
      } else {
        setFailed('Sesi web tidak dapat dipulihkan. Keluar lalu masuk kembali di aplikasi.');
      }
    }
  };

  const openExternal = useCallback((url: string) => {
    if (url.includes(WEB_HOST)) {
      // Halaman web madrasah dibuka di WebView yang sama (sudah login).
      ref.current?.injectJavaScript(`location.href = ${JSON.stringify(url)}; true;`);
      return;
    }
    WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
  }, []);

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    let msg: BridgeMessage;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'route') {
      if (msg.title && !params.title) setTitle(msg.title.replace(/\s*[|–-]\s*Super Apps.*$/i, '') || title);
    } else if (msg.type === 'open') {
      openExternal(msg.url);
    } else if (msg.type === 'print') {
      toast.info('Cetak dari aplikasi', 'Gunakan Unduh PDF bila tersedia, atau buka halaman ini di browser untuk mencetak.');
    } else if (msg.type === 'error') {
      toast.error(msg.message);
    } else if (msg.type === 'download') {
      try {
        const file = new File(Paths.cache, safeName(msg.name));
        if (file.exists) file.delete();
        file.create();
        file.write(msg.data, { encoding: 'base64' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: msg.mime, dialogTitle: msg.name });
        } else {
          toast.success('Berkas tersimpan', msg.name);
        }
      } catch {
        toast.error('Berkas gagal disimpan di perangkat.');
      }
    }
  }, [openExternal, params.title, title]);

  const onShouldStart = useCallback((req: { url: string; isTopFrame?: boolean }) => {
    const url = req.url;
    if (url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
    if (url.includes(WEB_HOST)) return true;
    if (req.isTopFrame === false) return true; // iframe pihak ketiga (mis. peta) tetap dimuat di dalam halaman
    if (/^(tel:|mailto:|whatsapp:|intent:|https?:)/.test(url)) openExternal(url);
    return false;
  }, [openExternal]);

  const reload = () => { setFailed(null); reloginTried.current = false; ref.current?.reload(); };

  return (
    <View style={[styles.root, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 4, backgroundColor: colors.brand }]}>
        <IconButton name="arrow-back" color="#FFFFFF" accessibilityLabel="Kembali" onPress={() => (canGoBack ? ref.current?.goBack() : router.back())} />
        <View style={{ flex: 1 }}>
          <T variant="subtitle" color={colors.onBrand} numberOfLines={1}>{title}</T>
          <T variant="small" color={colors.onBrand} style={{ opacity: 0.75 }} numberOfLines={1}>
            {(currentUrl || startUrl).replace(WEB_URL, '') || '/'}
          </T>
        </View>
        <IconButton name="refresh" color="#FFFFFF" accessibilityLabel="Muat ulang" onPress={reload} />
        <IconButton name="close" color="#FFFFFF" accessibilityLabel="Tutup" onPress={() => router.back()} />
      </View>
      {loading && progress < 1 ? <View style={[styles.progress, { width: `${Math.max(progress, 0.08) * 100}%`, backgroundColor: colors.warning }]} /> : null}

      {failed || (!online && !currentUrl) ? (
        <View style={styles.center}>
          <EmptyState
            icon={online ? 'alert-circle-outline' : 'cloud-offline-outline'}
            title={online ? 'Halaman tidak dapat dibuka' : 'Tidak ada koneksi internet'}
            message={failed ?? 'Menu ini memerlukan internet. Sambungkan lalu coba lagi.'}
            actionLabel="Coba lagi"
            onAction={reload}
          />
        </View>
      ) : (
        <WebView
          ref={ref}
          source={{ uri: startUrl }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          injectedJavaScriptBeforeContentLoaded={script}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly
          onMessage={onMessage}
          onNavigationStateChange={onNav}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
          onError={(e) => setFailed(e.nativeEvent.description || 'Gagal memuat halaman.')}
          onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setFailed(`Server bermasalah (${e.nativeEvent.statusCode}). Coba lagi nanti.`); }}
          renderLoading={() => <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess={false}
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
          mediaPlaybackRequiresUserAction
          originWhitelist={['https://*', 'http://*', 'about:*', 'blob:*', 'data:*']}
          applicationNameForUserAgent="MatsandatamaApp/1.0"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  progress: { height: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
