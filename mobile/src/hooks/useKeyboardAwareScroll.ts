/**
 * Android edge-to-edge (Expo SDK 57) tidak mengecilkan layar saat keyboard muncul, sehingga kolom isian
 * di bagian bawah bisa tertutup. Hook ini memberi ruang bawah setinggi keyboard pada ScrollView dan
 * menggulir otomatis agar kolom yang sedang diisi berada di atas keyboard (saat keyboard muncul dan
 * saat fokus berpindah ke kolom lain).
 */
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Dimensions, Keyboard, Platform, ScrollView, TextInput } from 'react-native';

/** Dipancarkan komponen Input saat mendapat fokus (fokus pindah antar kolom tidak memicu event keyboard). */
export const INPUT_FOCUS_EVENT = 'matsa:input-focus';

const GAP = 24; // jarak kolom ke tepi atas keyboard

export function useKeyboardAwareScroll(scrollRef: RefObject<ScrollView | null>) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const offsetY = useRef(0);
  /** Tepi atas keyboard pada koordinat layar (null = keyboard tertutup). */
  const kbTop = useRef<number | null>(null);

  const revealFocused = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput?.();
    const scroll = scrollRef.current?.getNativeScrollRef?.();
    const keyboardTop = kbTop.current;
    if (!input || !scroll || keyboardTop == null) return;
    // Hanya ScrollView yang tampil & memuat kolom fokus yang digulir (layar tab lain tetap terpasang
    // di belakang dengan ukuran nol / di luar layar).
    scroll.measureInWindow((sx, sy, sw, sh) => {
      if (!sw || !sh) return;
      input.measureInWindow((x, y, _w, h) => {
        if (x < sx || x > sx + sw || y < sy - h || y > sy + sh + h) return;
        // Batas bawah area terlihat: bila jendela mengecil saat keyboard muncul (adjustResize), tepi bawah
        // ScrollView sudah di atas keyboard; bila tidak (edge-to-edge), tepi atas keyboard yang membatasi.
        const visibleBottom = Math.min(sy + sh, keyboardTop);
        const overlap = y + h + GAP - visibleBottom;
        if (overlap > 0) scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
      });
    });
  }, [scrollRef]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      kbTop.current = e.endCoordinates.screenY || Dimensions.get('screen').height - e.endCoordinates.height;
      setKeyboardHeight(e.endCoordinates.height);
      // Ruang bawah perlu ter-render dulu (gulir pertama bisa terpotong panjang konten lama);
      // gulir kedua menghitung ulang dari posisi terkini.
      setTimeout(revealFocused, 80);
      setTimeout(revealFocused, 350);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      kbTop.current = null;
      setKeyboardHeight(0);
    });
    const focus = DeviceEventEmitter.addListener(INPUT_FOCUS_EVENT, () => { setTimeout(revealFocused, 120); setTimeout(revealFocused, 400); });
    return () => { show.remove(); hide.remove(); focus.remove(); };
  }, [revealFocused]);

  return {
    keyboardHeight,
    /** Pasang ke ScrollView: onScroll + scrollEventThrottle. */
    onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => { offsetY.current = e.nativeEvent.contentOffset.y; },
    /** Panggil saat kolom mendapat fokus (keyboard sudah terbuka, fokus pindah ke kolom lain). */
    revealFocused: () => setTimeout(revealFocused, 60),
  };
}
