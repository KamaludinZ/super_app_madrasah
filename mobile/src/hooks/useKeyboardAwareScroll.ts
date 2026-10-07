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
    const scroll = scrollRef.current;
    const keyboardTop = kbTop.current;
    if (!input || !scroll || keyboardTop == null) return;
    const node = scroll.getInnerViewNode?.() ?? scroll;
    // Hanya gulir ScrollView yang berisi kolom fokus (layar tab lain tetap terpasang di belakang).
    input.measureLayout(node as never, () => {
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + GAP - keyboardTop;
        if (overlap > 0) scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
      });
    }, () => { /* bukan anak ScrollView ini */ });
  }, [scrollRef]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      kbTop.current = e.endCoordinates.screenY || Dimensions.get('screen').height - e.endCoordinates.height;
      setKeyboardHeight(e.endCoordinates.height);
      // Tunggu ruang bawah ter-render dulu, baru gulir.
      setTimeout(revealFocused, 60);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      kbTop.current = null;
      setKeyboardHeight(0);
    });
    const focus = DeviceEventEmitter.addListener(INPUT_FOCUS_EVENT, () => setTimeout(revealFocused, 120));
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
