import { TextStyle } from 'react-native';

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const fontScale = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  caption: { fontFamily: fonts.regular, fontSize: fontScale.xs, lineHeight: 16 } as TextStyle,
  body: { fontFamily: fonts.regular, fontSize: fontScale.sm, lineHeight: 22 } as TextStyle,
  bodyMedium: { fontFamily: fonts.medium, fontSize: fontScale.sm, lineHeight: 22 } as TextStyle,
  bodySemibold: { fontFamily: fonts.semibold, fontSize: fontScale.sm, lineHeight: 22 } as TextStyle,
  label: { fontFamily: fonts.semibold, fontSize: fontScale.xs, lineHeight: 16 } as TextStyle,
  title: { fontFamily: fonts.semibold, fontSize: fontScale.lg, lineHeight: 28 } as TextStyle,
  heading: { fontFamily: fonts.bold, fontSize: fontScale.xl, lineHeight: 32 } as TextStyle,
  display: { fontFamily: fonts.bold, fontSize: fontScale.xxl, lineHeight: 40 } as TextStyle,
} as const;
