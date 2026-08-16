import React from 'react';
import { StyleSheet, Text, TextInput as RNTextInput, TextInputProps, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { typography } from '../../theme/typography';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextInput({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.container}>
      {label ? <Text style={[typography.label, styles.label]}>{label}</Text> : null}
      <RNTextInput
        placeholderTextColor={colors.muted}
        {...rest}
        style={[styles.input, error && styles.inputError, style]}
      />
      {error ? <Text style={[typography.caption, styles.errorText]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    color: colors.muted,
    letterSpacing: 1.1,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1,
  },
  errorText: {
    color: colors.error,
  },
});
