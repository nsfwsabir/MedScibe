import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, elevation, radius } from '../../theme/tokens';

type Variant = 'default' | 'elevated' | 'large';

type Props = ViewProps & {
  variant?: Variant;
};

export function Card({ variant = 'default', style, children, ...rest }: Props) {
  return (
    <View style={[styles.base, variant === 'large' && styles.large, variant === 'elevated' && elevation.default, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
  },
  large: {
    borderRadius: radius.lg,
  },
});
