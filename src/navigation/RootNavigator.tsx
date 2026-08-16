import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../features/auth/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppTabs } from './AppTabs';
import { colors } from '../theme/tokens';

export function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);

  if (initializing) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return session ? <AppTabs /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
