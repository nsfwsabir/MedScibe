import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { useAuthStore } from '../../features/auth/authStore';
import { isBackendConfigured } from '../../lib/env';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const signIn = useAuthStore((s) => s.signIn);
  const clearError = useAuthStore((s) => s.clearError);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError('Sign-in failed. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brand}>
        <Text style={[typography.display, styles.brandTitle]}>MedScribe</Text>
        <Text style={[typography.body, styles.brandSubtitle]}>
          Warm, thoughtful clinical transcription
        </Text>
      </View>

      {!isBackendConfigured ? (
        <View style={styles.notice}>
          <Text style={[typography.bodySemibold, { color: colors.text }]}>Backend not configured</Text>
          <Text style={[typography.body, { color: colors.muted }]}>
            Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in a .env file (see
            .env.example), then restart the app.
          </Text>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            label="EMAIL ADDRESS"
            placeholder="dr.sharma@familyhealth.org"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearError();
            }}
          />
          <TextInput
            label="PASSWORD"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearError();
            }}
          />
          <Text style={[typography.bodyMedium, styles.forgot]}>Forgot password?</Text>
          {error ? <Text style={[typography.caption, styles.errorText]}>{error}</Text> : null}
          <Button label="Sign In" size="lg" onPress={handleSignIn} disabled={submitting || !email || !password} />
          <View style={styles.createRow}>
            <Text style={[typography.body, { color: colors.muted }]}>New to MedScribe?</Text>
            <Text
              style={[typography.bodySemibold, styles.createLink]}
              onPress={() => navigation.navigate('CreateAccount')}
            >
              Create Account
            </Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandTitle: {
    color: colors.primary,
  },
  brandSubtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
  notice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
  forgot: {
    color: colors.primary,
    textAlign: 'right',
  },
  errorText: {
    color: colors.error,
  },
  createRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  createLink: {
    color: colors.primary,
  },
});
