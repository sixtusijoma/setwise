export const lightColors = {
  bg: '#F4F2EE',
  surface: '#FFFFFF',
  sunken: '#ECE9E3',
  hairline: '#E3DFD8',
  ink: '#141412',
  ink2: '#6B6862',
  ink3: '#A19D95',
  accent: '#E8551E',
  accentInk: '#FFFFFF',
  accentSoft: '#FBE6DC',
  cardio: '#2C6BED',
  cardioInk: '#FFFFFF',
  cardioSoft: '#DFE8FC',
  pr: '#A87A12',
  prSoft: '#F5EBD3',
  danger: '#C8361F',
  tile: '#F4F2EE',
  shadow: 'rgba(20, 20, 18, 0.10)',
} as const;

export const darkColors = {
  bg: '#0E0E0D',
  surface: '#1A1A18',
  sunken: '#242421',
  hairline: '#2B2A27',
  ink: '#F2F0EB',
  ink2: '#A3A099',
  ink3: '#6E6B65',
  accent: '#FF6B33',
  accentInk: '#160A04',
  accentSoft: '#3A1E12',
  cardio: '#6A97FF',
  cardioInk: '#06122E',
  cardioSoft: '#172447',
  pr: '#E2B44A',
  prSoft: '#352A10',
  danger: '#FF6A5C',
  tile: '#EDEAE4',
  shadow: 'rgba(0, 0, 0, 0.50)',
} as const;

export type ThemeColors = {
  [Key in keyof typeof lightColors]: string;
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radius = {
  input: 12,
  button: 16,
  card: 20,
  sheet: 24,
  pill: 999,
  thumb: 14,
  thumbSm: 8,
} as const;
