import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNote, useSoftDeleteNote } from '../../features/notes/notesQueries';
import { RichText } from '../../features/notes/formatting';
import { useAuthStore } from '../../features/auth/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NoteDetail'>;

export function NoteDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const { data: note } = useNote(id);
  const softDelete = useSoftDeleteNote();
  const signOut = useAuthStore((s) => s.signOut);

  if (!note) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={[typography.body, { color: colors.muted }]}>Loading note...</Text>
      </View>
    );
  }

  const shortId = note.id.slice(0, 5).toUpperCase();
  const metaBits = [
    note.patient_age != null ? `${note.patient_age}yo` : null,
    note.patient_sex,
    `Visit: ${new Date(note.visit_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`,
  ].filter(Boolean);

  const handleDelete = () => {
    softDelete.mutate(id, { onSuccess: () => navigation.goBack() });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={[typography.title, { color: colors.text }]}>←</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            hitSlop={8}
            onPress={async () => {
              await signOut();
            }}
          >
            <Text style={[typography.bodyMedium, { color: colors.muted }]}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Badge label={note.status.toUpperCase()} variant={note.status === 'draft' ? 'draft' : 'finalized'} />
          <Text style={[typography.caption, { color: colors.muted }]}>ID: #{shortId}</Text>
        </View>
        <Text style={[typography.heading, { color: colors.text }]}>
          {note.patient_name ?? 'Untitled note'}
        </Text>
        <Text style={[typography.body, { color: colors.muted }]}>{metaBits.join(' · ') || 'No patient details'}</Text>

        <Card style={styles.sectionCard}>
          <RichText value={note.note_text ?? '—'} baseStyle={{ color: colors.text }} />
        </Card>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button label="Edit" variant="secondary" onPress={() => navigation.navigate('NoteEdit', { id })} />
        <Button label="PDF" variant="secondary" />
        <Button label="Share" variant="secondary" />
        <Button label="Delete" variant="ghost" onPress={handleDelete} disabled={softDelete.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionCard: {
    padding: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
