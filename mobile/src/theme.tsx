/**
 * Token desain Super Apps MATSANDATAMA (dari design_guidelines.json).
 * Semua warna UI WAJIB diambil dari sini melalui `useTheme()`.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const palette = {
  light: {
    surface: '#FFFFFF',
    onSurface: '#1A1C1E',
    surfaceSecondary: '#F5F6F8',
    onSurfaceSecondary: '#444749',
    surfaceTertiary: '#EAECEF',
    onSurfaceTertiary: '#444749',
    surfaceInverse: '#2F3132',
    onSurfaceInverse: '#F0F1F3',
    brand: '#006837',
    brandPrimary: '#006837',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#0B7A3B',
    onBrandSecondary: '#FFFFFF',
    brandTertiary: '#E6F0EB',
    onBrandTertiary: '#006837',
    success: '#198754',
    onSuccess: '#FFFFFF',
    warning: '#FFC107',
    onWarning: '#4B3800',
    warningSoft: '#FFF4CC',
    error: '#DC3545',
    onError: '#FFFFFF',
    errorSoft: '#FBE4E7',
    border: '#EAECEF',
    borderStrong: '#C8CBD0',
    divider: '#F5F6F8',
    muted: '#747779',
    onBrand: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.45)',
    skeleton: '#E3E5E8',
  },
  dark: {
    surface: '#121212',
    onSurface: '#E1E2E4',
    surfaceSecondary: '#1E1E1E',
    onSurfaceSecondary: '#C4C6C8',
    surfaceTertiary: '#2C2C2C',
    onSurfaceTertiary: '#A9ABAE',
    surfaceInverse: '#E1E2E4',
    onSurfaceInverse: '#121212',
    brand: '#006837',
    brandPrimary: '#2E8B57',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#3CB371',
    onBrandSecondary: '#FFFFFF',
    brandTertiary: '#003A1F',
    onBrandTertiary: '#99E5BC',
    success: '#2E9E63',
    onSuccess: '#FFFFFF',
    warning: '#FFC107',
    onWarning: '#4B3800',
    warningSoft: '#3D3100',
    error: '#E4606D',
    onError: '#FFFFFF',
    errorSoft: '#3A1C20',
    border: '#2C2C2C',
    borderStrong: '#444749',
    divider: '#1E1E1E',
    muted: '#A9ABAE',
    onBrand: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.6)',
    skeleton: '#2A2A2A',
  },
} as const;

export type Colors = { [K in keyof typeof palette.light]: string };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const fontSize = { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, hero: 30 } as const;
export const fonts = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
} as const;
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

export type ThemeMode = 'system' | 'light' | 'dark';
const MODE_KEY = 'prefs.themeMode';

type ThemeCtx = {
  colors: Colors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  colors: palette.light,
  isDark: false,
  mode: 'system',
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [system, setSystem] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  };

  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  const value = useMemo(
    () => ({ colors: (isDark ? palette.dark : palette.light) as Colors, isDark, mode, setMode }),
    [isDark, mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
