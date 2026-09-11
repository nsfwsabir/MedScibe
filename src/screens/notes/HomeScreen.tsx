import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Badge } from '../../components/ui/Badge';
import { TextInput } from '../../components/ui/TextInput';
import { ChevronDownIcon, FilterIcon } from '../../components/ui/icons';
import { useNotes } from '../../features/notes/notesQueries';
import { Note } from '../../features/notes/notesApi';
import { plainText } from '../../features/notes/formatting';
import { useAuthStore } from '../../features/auth/authStore';
import { useProfileStore, getGreeting } from '../../features/profile/profileStore';
import { usePendingNotes, useSyncPendingNotes } from '../../features/offline/usePendingNotes';
import { Button } from '../../components/ui/Button';
import NetInfo from '@react-native-community/netinfo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<NotesStackParamList, 'Home'>;

type Filter = 'all' | 'draft' | 'finalized';
type DateFilter = 'all' | 'today' | 'week' | 'month';

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function NoteCard({ note, onPress }: { note: Note; onPress: () => void }) {
  const title = note.patient_name ?? 'Untitled report';
  const snippet = plainText(note.note_text ?? note.raw_transcript ?? '');
  const edited =
    note.updated_at && note.created_at && Math.abs(new Date(note.updated_at).getTime() - new Date(note.created_at).getTime()) > 60_000
      ? formatDateTime(note.updated_at)
      : null;
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
        </View>
        <Text style={[typography.caption, { color: colors.mutedLight }]}>
          Created {formatDateTime(note.created_at)}
          {edited ? `  ·  Edited ${edited}` : ''}
        </Text>
      </Card>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabNavigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const { profile } = useProfileStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [filtersVisible, setFiltersVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const dateFrom = (() => {
    if (dateFilter === 'all') return undefined;
    const d = new Date();
    if (dateFilter === 'today') return d.toISOString().slice(0, 10);
    if (dateFilter === 'week') {
      const w = new Date();
      w.setDate(d.getDate() - 6);
      return w.toISOString().slice(0, 10);
    }
    const m = new Date();
    m.setDate(d.getDate() - 29);
    return m.toISOString().slice(0, 10);
  })();

  const { data: notes, isLoading } = useNotes({
    status: filter === 'all' ? undefined : filter,
    query: debouncedQuery || undefined,
    dateFrom,
  });

  const { data: pending } = usePendingNotes();
  const syncPending = useSyncPendingNotes();
  const [syncing, setSyncing] = useState(false);
  const pendingCount = pending?.length ?? 0;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPending();
    } finally {
      setSyncing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // Try to sync when screen gains focus if online
      NetInfo.fetch().then((s) => {
        if (s.isConnected) void syncPending().catch(() => {});
      });
    }, [syncPending]),
  );

  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      if (s.isConnected) void syncPending().catch(() => {});
    });
    return () => sub();
  }, [syncPending]);

  const emailName = user?.email?.split('@')[0] ?? 'Doctor';
  const derivedName = emailName.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const displayName = profile.displayName?.trim() || derivedName;
  const greeting = getGreeting();
  const first = displayName[0]?.toUpperCase() ?? 'D';
  const draftCount = notes?.filter((n) => n.status === 'draft').length ?? 0;
  const activeFilterCount = (filter === 'all' ? 0 : 1) + (dateFilter === 'all' ? 0 : 1);
  const clearFilters = () => {
    setFilter('all');
    setDateFilter('all');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.body, { color: colors.muted }]}>{greeting},</Text>
          <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <Pressable onPress={() => tabNavigation.navigate('SettingsTab', { screen: 'Profile' })} hitSlop={8}>
          <View style={styles.avatar}>
            <Text style={[typography.bodySemibold, { color: colors.text }]}>{first}</Text>
          </View>
        </Pressable>
      </View>

      <TextInput
        placeholder="Search patients or complaints..."
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filters"
        onPress={() => setFiltersVisible(true)}
        style={({ pressed }) => [styles.filtersButton, pressed && styles.filtersButtonPressed]}
      >
        <FilterIcon size={20} color={activeFilterCount > 0 ? colors.primary : colors.text} />
        <Text style={[typography.bodySemibold, { color: activeFilterCount > 0 ? colors.primary : colors.text }]}>
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Text>
        <ChevronDownIcon size={18} color={activeFilterCount > 0 ? colors.primary : colors.text} />
      </Pressable>

      <BottomSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)}>
        <Text style={[typography.bodySemibold, { color: colors.text }]}>Filter reports</Text>

        <Text style={[typography.caption, { color: colors.muted }]}>STATUS</Text>
        <View style={styles.sheetChips}>
          <Chip label="All Reports" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={`Drafts (${draftCount})`} selected={filter === 'draft'} onPress={() => setFilter('draft')} />
          <Chip label="Finalized" selected={filter === 'finalized'} onPress={() => setFilter('finalized')} />
        </View>

        <Text style={[typography.caption, { color: colors.muted }]}>DATE</Text>
        <View style={styles.sheetChips}>
          <Chip label="All dates" selected={dateFilter === 'all'} onPress={() => setDateFilter('all')} />
          <Chip label="Today" selected={dateFilter === 'today'} onPress={() => setDateFilter('today')} />
          <Chip label="7 days" selected={dateFilter === 'week'} onPress={() => setDateFilter('week')} />
          <Chip label="30 days" selected={dateFilter === 'month'} onPress={() => setDateFilter('month')} />
        </View>

        <View style={styles.sheetActions}>
          <Button label="Clear" variant="ghost" onPress={clearFilters} disabled={activeFilterCount === 0} style={{ flex: 1 }} />
          <Button label="Done" onPress={() => setFiltersVisible(false)} style={{ flex: 1 }} />
        </View>
      </BottomSheet>

      {pendingCount > 0 ? (
        <Card style={styles.pendingBanner}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>
            {pendingCount} report{pendingCount > 1 ? 's' : ''} pending offline
          </Text>
          <Button label={syncing ? 'Syncing...' : 'Sync now'} variant="secondary" onPress={handleSync} disabled={syncing} />
        </Card>
      ) : null}

      <FlatList
        data={notes ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NoteCard note={item} onPress={() => navigation.navigate('NoteDetail', { id: item.id })} />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isLoading ? (
            <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]}>
              Loading reports...
            </Text>
          ) : (
            <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]}>
              No reports yet. Tap + to create your first one.
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
    flexShrink: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    marginBottom: spacing.sm,
    flexShrink: 0,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    marginBottom: spacing.md,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    flexShrink: 0,
  },
  filtersButtonPressed: {
    opacity: 0.7,
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  pendingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    flexShrink: 0,
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
