import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { useUiStore } from '../../features/ui/uiStore';
import { useCreateNote } from '../../features/notes/notesQueries';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

export function NewNoteModal() {
  const visible = useUiStore((s) => s.newNoteModalVisible);
  const setVisible = useUiStore((s) => s.setNewNoteModalVisible);
  const createNote = useCreateNote();
  const navigation = useNavigation<NativeStackNavigationProp<NotesStackParamList>>();

  const startNote = async (noteType: 'dictation' | 'consultation') => {
    setVisible(false);
    const note = await createNote.mutateAsync({
      note_type: noteType,
      status: 'draft',
      visit_date: new Date().toISOString().slice(0, 10),
    });
    navigation.navigate('NoteEdit', { id: note.id });
  };

  return (
    <BottomSheet visible={visible} onClose={() => setVisible(false)}>
      <View style={styles.header}>
        <Text style={[typography.title, { color: colors.text }]}>Start New Note</Text>
        <Text style={[typography.body, { color: colors.muted }]}>
          Choose the note format that best fits the encounter.
        </Text>
      </View>

      <Pressable onPress={() => startNote('dictation')} disabled={createNote.isPending}>
        <Card style={styles.target}>
          <Text style={styles.targetIcon}>🎙️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodySemibold, { color: colors.text }]}>Quick Dictation</Text>
            <Text style={[typography.caption, { color: colors.muted }]}>
              Summarize after the patient visit
            </Text>
          </View>
          <Text style={[typography.title, { color: colors.muted }]}>›</Text>
        </Card>
      </Pressable>

      <Pressable onPress={() => startNote('consultation')} disabled={createNote.isPending}>
        <Card style={styles.target}>
          <Text style={styles.targetIcon}>🔴</Text>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodySemibold, { color: colors.text }]}>Record Consultation</Text>
            <Text style={[typography.caption, { color: colors.muted }]}>Capture the live visit directly</Text>
          </View>
          <Text style={[typography.title, { color: colors.muted }]}>›</Text>
        </Card>
      </Pressable>

      <Button label="Cancel" variant="ghost" onPress={() => setVisible(false)} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  targetIcon: {
    fontSize: 22,
  },
});
