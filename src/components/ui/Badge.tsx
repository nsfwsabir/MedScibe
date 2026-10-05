import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

type Variant = 'draft' | 'finalized';

const variantColors: Record<Variant, { bg: string; fg: string }> = {
  draft: { bg: '#CC634520', fg: colors.primary },
  finalized: { bg: colors.successBg, fg: colors.success },
};

type Props = {
  label: string;
  variant?: Variant;
};

export function Badge({ label, variant = 'draft' }: Props) {
  const c = variantColors[variant];
  return (
    <Text style={[styles.base, { backgroundColor: c.bg, color: c.fg }]}>{label}</Text>
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
