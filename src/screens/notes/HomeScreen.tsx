import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Badge } from '../../components/ui/Badge';
import { TextInput } from '../../components/ui/TextInput';
import { useNotes } from '../../features/notes/notesQueries';
import { Note } from '../../features/notes/notesApi';
import { useAuthStore } from '../../features/auth/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'Home'>;

type Filter = 'all' | 'draft' | 'finalized';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) {
    return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function NoteCard({ note, onPress }: { note: Note; onPress: () => void }) {
  const title = note.patient_name ?? 'Untitled note';
  const snippet = note.raw_transcript ?? note.chief_complaint ?? note.subjective ?? '';
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.noteCard}>
        <View style={styles.cardHeader}>
          <Text style={[typography.bodySemibold, styles.cardTitle]} numberOfLines={1}>
            {title}
          </Text>
          <Badge label={note.status.toUpperCase()} variant={note.status === 'draft' ? 'draft' : 'finalized'} />
        </View>
        <Text style={[typography.body, styles.cardSnippet]} numberOfLines={2}>
          {snippet}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[typography.caption, { color: colors.muted }]}>{formatDate(note.visit_date)}</Text>
          <Badge label={note.note_type === 'dictation' ? 'Dictation' : 'Consultation'} variant="neutral" />
        </View>
      </Card>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const { data: notes, isLoading } = useNotes({
    status: filter === 'all' ? undefined : filter,
    query: query.trim() || undefined,
  });

  const first = user?.email?.[0]?.toUpperCase() ?? 'D';
  const draftCount = notes?.filter((n) => n.status === 'draft').length ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.body, { color: colors.muted }]}>Good morning,</Text>
          <Text style={[typography.title, { color: colors.text }]}>{user?.email ?? 'Doctor'}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={[typography.bodySemibold, { color: colors.white }]}>{first}</Text>
        </View>
      </View>

      <TextInput
        placeholder="Search patients or complaints..."
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />

      <View style={styles.chips}>
        <Chip label="All Notes" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Drafts (${draftCount})`} selected={filter === 'draft'} onPress={() => setFilter('draft')} />
        <Chip label="Finalized" selected={filter === 'finalized'} onPress={() => setFilter('finalized')} />
      </View>

      <FlatList
        data={notes ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NoteCard note={item} onPress={() => navigation.navigate('NoteDetail', { id: item.id })} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          isLoading ? (
            <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]}>
              Loading notes...
            </Text>
          ) : (
            <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]}>
              No notes yet. Tap + to create your first one.
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  noteCard: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardSnippet: {
    color: colors.muted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
