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

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateAccount'>;

export function CreateAccountScreen({ navigation }: Props) {
  const signUp = useAuthStore((s) => s.signUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await signUp(email.trim(), password);
      const session = useAuthStore.getState().session;
      if (!session) {
        setMessage(
          'Account created. Check your inbox for a confirmation link, then sign in.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[typography.heading, { color: colors.text }]}>Create Account</Text>
      {!isBackendConfigured ? (
        <View style={styles.notice}>
          <Text style={[typography.body, { color: colors.muted }]}>
            Backend not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
            in a .env file, then restart the app.
          </Text>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            label="EMAIL ADDRESS"
            placeholder="you@clinic.org"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            label="PASSWORD"
            placeholder="At least 6 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={[typography.caption, styles.errorText]}>{error}</Text> : null}
          {message ? <Text style={[typography.caption, styles.messageText]}>{message}</Text> : null}
          <Button label="Create Account" size="lg" onPress={handleSignUp} disabled={submitting || !email || password.length < 6} />
          <Button label="Back to Sign In" variant="ghost" onPress={() => navigation.goBack()} />
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
  notice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
  },
  form: {
    gap: spacing.md,
  },
  errorText: {
    color: colors.error,
  },
  messageText: {
    color: colors.primary,
  },
});
