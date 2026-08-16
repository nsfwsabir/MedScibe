import React from 'react';
import { StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

type Variant = 'draft' | 'finalized' | 'neutral';

const variantColors: Record<Variant, { bg: string; fg: string }> = {
  draft: { bg: '#CC634520', fg: colors.primary },
  finalized: { bg: '#2E7D3218', fg: '#2E7D32' },
  neutral: { bg: colors.border, fg: colors.muted },
};

type Props = {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
};

export function Badge({ label, variant = 'neutral', style }: Props) {
  const c = variantColors[variant];
  return (
    <Text style={[styles.base, { backgroundColor: c.bg, color: c.fg }, style]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
