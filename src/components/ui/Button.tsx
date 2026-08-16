import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

type Props = {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  onPress?: () => void;
  label: string;
  style?: ViewStyle;
};

const variantStyles: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
};

const pressedStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primaryHover },
  secondary: { backgroundColor: colors.secondaryHover },
  ghost: { backgroundColor: colors.ghostHover },
};

export function Button({ variant = 'primary', size = 'md', disabled, onPress, label, style }: Props) {
  const textColor =
    variant === 'primary' ? colors.white : variant === 'secondary' ? colors.text : colors.muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { paddingVertical: size === 'lg' ? 14 : 10 },
        variantStyles[variant],
        pressed && !disabled && pressedStyles[variant],
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          typography.bodySemibold,
          { color: textColor, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  disabled: {
    opacity: 0.4,
  },
});
