import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { useAuthStore } from '../../features/auth/authStore';
import { useSettingsStore, RetentionDays } from '../../features/settings/settingsStore';
import { useMacros, useCreateMacro, useDeleteMacro } from '../../features/macros/macrosQueries';
import { normalizeShortcut, validateMacro } from '../../features/macros/macrosApi';
import { RichText } from '../../features/notes/formatting';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { retainOriginalAudio, retentionDays, setRetainOriginalAudio, setRetentionDays } =
    useSettingsStore();
  const { data: macros } = useMacros();
  const [macroShortcut, setMacroShortcut] = useState('');
  const [macroExpansion, setMacroExpansion] = useState('');
  const [macroError, setMacroError] = useState<string | null>(null);
  const createMacroM = useCreateMacro();
  const deleteMacroM = useDeleteMacro();

  const handleAddMacro = async () => {
    const validation = validateMacro({ shortcut: macroShortcut, expansion: macroExpansion });
    if (validation) {
      setMacroError(validation);
      return;
    }
    setMacroError(null);
    try {
      await createMacroM.mutateAsync({
        shortcut: normalizeShortcut(macroShortcut),
        expansion: macroExpansion,
      });
      setMacroShortcut('');
      setMacroExpansion('');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save the macro.';
      setMacroError(/duplicate|unique/i.test(message) ? 'That shortcut already exists.' : message);
    }
  };

  const name = user?.email?.split('@')[0] ?? 'Doctor';
  const displayName = name
    .split(/[._-]/)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
  const initial = displayName[0] ?? 'D';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={[typography.heading, { color: colors.text, marginBottom: spacing.md }]}>Settings</Text>

      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={[typography.bodySemibold, { color: colors.white }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodySemibold, { color: colors.text }]}>{displayName}</Text>
          <Text style={[typography.caption, { color: colors.muted }]}>{user?.email}</Text>
        </View>
      </Card>

      <Card style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyMedium, { color: colors.text }]}>Retain Original Audio</Text>
            <Text style={[typography.caption, { color: colors.muted, marginTop: spacing.xs }]}>
              Audio records are kept solely for dictation verify-checks. Note files persist securely
              forever regardless of audio settings.
            </Text>
          </View>
          <Switch
            value={retainOriginalAudio}
            onValueChange={setRetainOriginalAudio}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
          />
        </View>
        <View style={styles.retentionRow}>
          {([30, 60, 90] as RetentionDays[]).map((days) => (
            <Chip
              key={days}
              label={`${days} days`}
              selected={retainOriginalAudio && retentionDays === days}
              onPress={() => setRetentionDays(days)}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={[typography.bodySemibold, { color: colors.text }]}>Quick Macros</Text>
        <Text style={[typography.caption, { color: colors.muted }]}>
          Type a shortcut and a space in the editor to expand it. Also auto-expands in cleaned dictation.
        </Text>

        {(macros ?? []).length > 0 ? (
          <View style={styles.macroList}>
            {(macros ?? []).map((m) => (
              <View key={m.id} style={styles.macroRow}>
                <View style={styles.macroShortcutWrap}>
                  <Text style={[typography.bodySemibold, styles.macroShortcut]} numberOfLines={1}>
                    {m.shortcut}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <RichText value={m.expansion} baseStyle={{ color: colors.text }} />
                </View>
                <Pressable hitSlop={8} disabled={deleteMacroM.isPending} onPress={() => deleteMacroM.mutate(m.id)}>
                  <Text style={[typography.bodyMedium, styles.macroDelete]}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[typography.body, { color: colors.muted }]}>
            No macros yet. Add one below — for example “fup2w” → “Follow up in two weeks”.
          </Text>
        )}

        <View style={styles.macroForm}>
          <TextInput
            label="SHORTCUT"
            placeholder="fup2w"
            autoCapitalize="none"
            autoCorrect={false}
            value={macroShortcut}
            onChangeText={(t) => setMacroShortcut(t.toLowerCase())}
            style={{ flex: 1 }}
          />
          <TextInput
            label="EXPANDS TO"
            placeholder="Follow up in two weeks"
            value={macroExpansion}
            onChangeText={setMacroExpansion}
            style={{ flex: 2 }}
          />
        </View>
        {macroError ? <Text style={[typography.caption, { color: colors.error }]}>{macroError}</Text> : null}
        <Button label="Add Macro" variant="secondary" onPress={handleAddMacro} disabled={createMacroM.isPending} />
      </Card>

      <Card style={styles.section}>
        <View style={styles.row}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>MedScribe AI Engine Version</Text>
          <Text style={[typography.bodySemibold, { color: colors.muted }]}>v2.4.1</Text>
        </View>
        <View style={[styles.row, styles.borderTop]}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>DPDP Compliance Certificate</Text>
          <Text style={[typography.bodySemibold, { color: '#2E7D32' }]}>Verified</Text>
        </View>
        <View style={[styles.row, styles.borderTop]}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>Contact Practice Support</Text>
          <Text style={[typography.title, { color: colors.muted }]}>›</Text>
        </View>
      </Card>

      <Button label="Sign Out of MedScribe" variant="ghost" onPress={() => signOut()} />
      <Pressable hitSlop={8} style={styles.legalRow}>
        <Text style={[typography.caption, { color: colors.muted, textAlign: 'center' }]}>
          MedScribe v0.1.0 · Privacy · Terms
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  retentionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  legalRow: {
    marginTop: spacing.sm,
  },
  macroList: {
    gap: spacing.xs,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  macroShortcutWrap: {
    minWidth: 72,
    maxWidth: 110,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  macroShortcut: {
    color: colors.primary,
  },
  macroDelete: {
    color: colors.muted,
    paddingHorizontal: spacing.xs,
  },
  macroForm: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
