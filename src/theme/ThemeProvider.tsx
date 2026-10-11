import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme, useWindowDimensions } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './tokens';
import { usePrefs, type Appearance } from './prefs';

type ColorMode = 'light' | 'dark';
type WidthClass = 'compact' | 'regular' | 'large';

type Theme = {
  colors: ThemeColors;
  mode: ColorMode;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  gutter: number;
  widthClass: WidthClass;
  width: number;
  height: number;
};

const ThemeContext = createContext<Theme | null>(null);

function useSystemScheme(): ColorMode {
  const rn = useColorScheme();
  const [web, setWeb] = useState<ColorMode | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setWeb(media.matches ? 'dark' : 'light');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  if (Platform.OS === 'web' && web) return web;
  return rn === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useSystemScheme();
  const appearance = usePrefs((state) => state.appearance);
  const setAppearance = usePrefs((state) => state.setAppearance);
  const { width, height } = useWindowDimensions();
  const mode: ColorMode = appearance === 'system' ? system : appearance;
  const colors = mode === 'dark' ? darkColors : lightColors;
  const widthClass: WidthClass = width < 380 ? 'compact' : width >= 420 ? 'large' : 'regular';
  const gutter = width < 380 ? 16 : 20;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'setwise-focus';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = 'input, textarea { outline: none; }';
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = colors.bg;
    document.body.style.backgroundColor = colors.bg;
    document.body.style.margin = '0';
  }, [colors.bg]);

  const value = useMemo(
    () => ({ colors, mode, appearance, setAppearance, gutter, widthClass, width, height }),
    [colors, mode, appearance, setAppearance, gutter, widthClass, width, height],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
}
