import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius } from '../../theme/tokens';

type Props = ViewProps;

export function Card({ style, children, ...rest }: Props) {
  return (
    <View style={[styles.base, style]} {...rest}>
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
});
