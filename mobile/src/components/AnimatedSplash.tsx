/**
 * Layar pembuka beranimasi: menyambung mulus dari splash native (latar hijau + logo 180 dp yang sama),
 * logo berdenyut pelan dan cincin loading berputar sampai aplikasi siap, lalu memudar.
 * Splash native disembunyikan begitu layar ini selesai tata letak agar tidak ada kedipan.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/store/auth';

const BG = '#006837';
const LOGO = 180;
const MIN_VISIBLE_MS = 1800;
/** Jeda setelah siap agar layar tujuan sempat tergambar sebelum splash memudar (tanpa kedipan kosong). */
const SETTLE_MS = 450;

export function AnimatedSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    Animated.timing(appear, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => { clearTimeout(t); loops.forEach((l) => l.stop()); };
  }, [pulse, spin, appear]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true })
        .start(({ finished }) => { if (finished) onFinish(); });
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [ready, minElapsed, opacity, onFinish]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
      onLayout={() => { SplashScreen.hideAsync().catch(() => {}); }}
      pointerEvents={ready ? 'none' : 'auto'}
      accessibilityLabel="Memuat aplikasi"
      accessibilityRole="progressbar"
    >
      <Animated.Image source={require('../../assets/images/splash-icon.png')} style={[styles.logo, { transform: [{ scale }] }]} resizeMode="contain" />
      <Animated.View style={[styles.loader, { opacity: appear }]}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Text style={styles.text}>Memuat aplikasi…</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BG, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  logo: { width: LOGO, height: LOGO },
  // Diletakkan absolut di bawah logo agar posisi logo tetap sama persis dengan splash native.
  loader: { position: 'absolute', top: '50%', marginTop: LOGO / 2 + 48, alignItems: 'center', gap: 14 },
  ring: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#FFFFFF',
  },
  text: { color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: 0.3 },
});

/** Dipasang di dalam AuthProvider: memberi tahu saat pemulihan sesi dari penyimpanan selesai. */
export function AuthReadyReporter({ onReady }: { onReady: () => void }) {
  const { loading } = useAuth();
  useEffect(() => { if (!loading) onReady(); }, [loading, onReady]);
  return null;
}
