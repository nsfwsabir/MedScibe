import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../../theme/tokens';
import { typography } from '../../theme/typography';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected = false, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[typography.bodyMedium, selected ? styles.textSelected : styles.textDefault]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  textDefault: {
    color: colors.text,
  },
  textSelected: {
    color: colors.white,
  },
});
