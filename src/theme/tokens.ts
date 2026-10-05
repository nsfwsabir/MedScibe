export const colors = {
  primary: '#CC6345',
  primaryHover: '#B8593E',
  primaryFocusRing: '#CC63451F',
  background: '#F2ECE4',
  surface: '#FDFBF7',
  surfaceSubtle: '#F5F0EA',
  text: '#24211E',
  border: '#F5E6E1',
  borderStrong: '#C9BDB9',
  borderSubtle: '#EBE3DA',
  muted: '#66615D',
  mutedLight: '#948E89',
  secondaryHover: '#24211E0A',
  ghostHover: '#24211E06',
  error: '#EF4444',
  success: '#4E7E63',
  successBg: '#EBF2EE',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
} as const;

export const elevation = {
  default: {
    shadowColor: '#24211E',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  md: {
    shadowColor: '#24211E',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;
