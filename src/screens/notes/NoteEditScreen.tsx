import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { useNote, useUpdateNote } from '../../features/notes/notesQueries';
import { Note } from '../../features/notes/notesApi';
import TenTapEditor, { TenTapEditorHandle } from '../../components/ui/TenTapEditor';
import { Toolbar } from '@10play/tentap-editor';
import { useMacros } from '../../features/macros/macrosQueries';
import { logAudit } from '../../features/audit/auditApi';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NoteEdit'>;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderTranscript(text: string, lowConfidenceSpans: string[] | null): ReactNode {
  const spans = (lowConfidenceSpans ?? []).filter((s) => s.trim().length > 0);
  if (spans.length === 0) {
    return <Text style={[typography.body, styles.transcriptText]}>{text}</Text>;
  }
  const pattern = new RegExp(`(${spans.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <Text style={[typography.body, styles.transcriptText]}>
      {parts.map((part, i) =>
        spans.some((s) => s.toLowerCase() === part.toLowerCase()) ? (
          <Text key={i} style={[typography.bodySemibold, { color: colors.error }]}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

export function NoteEditScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const { data: note } = useNote(id);

  if (!note) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={[typography.body, { color: colors.muted }]}>Loading report...</Text>
      </View>
    );
  }

  return (
    <NoteEditor
      key={note.id}
      id={id}
      initialNote={note}
      insetsTop={insets.top}
      insetsBottom={insets.bottom}
    />
  );
}

function NoteEditor({
  id,
  initialNote: note,
  insetsTop,
  insetsBottom,
}: {
  id: string;
  initialNote: Note;
  insetsTop: number;
  insetsBottom: number;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<NotesStackParamList>>();
  const updateNote = useUpdateNote();

  const [patientName, setPatientName] = useState(note?.patient_name ?? '');
  const [patientAge, setPatientAge] = useState(note?.patient_age != null ? String(note.patient_age) : '');
  const [patientSex, setPatientSex] = useState(note?.patient_sex ?? '');
  const [visitDate, setVisitDate] = useState(note?.visit_date ?? '');
  const [noteText, setNoteText] = useState(note?.note_text ?? note?.raw_transcript ?? '');
  const [saving, setSaving] = useState(false);

  const { data: macros } = useMacros();
  const editorRef = React.useRef<TenTapEditorHandle>(null);
  const [editorBridge, setEditorBridge] = React.useState<any>(null);

  // Poll for editor instance (10tap creates it async)
  React.useEffect(() => {
    const id = setInterval(() => {
      const e = editorRef.current?.editor;
      if (e) {
        setEditorBridge(e);
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  const persist = async (finalize: boolean) => {
    if (!note) return;
    setSaving(true);
    try {
      const age = patientAge ? parseInt(patientAge, 10) : null;
      await updateNote.mutateAsync({
        id,
        patch: {
          patient_name: patientName || null,
          patient_age: age && !Number.isNaN(age) ? age : null,
          patient_sex: patientSex || null,
          visit_date: visitDate || undefined,
          note_text: noteText || null,
          status: finalize ? 'finalized' : 'draft',
        },
      });
      void logAudit(id, 'update');
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const initials = (patientName || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insetsTop + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={[typography.title, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[typography.title, { color: colors.text }]}>Edit Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.patientCard}>
          <View style={styles.patientRow}>
            <View style={styles.avatar}>
              <Text style={[typography.bodySemibold, { color: colors.text }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodySemibold, { color: colors.text }]}>{patientName || 'Patient'}</Text>
              <Text style={[typography.caption, { color: colors.muted }]}>
                {[
                  patientAge ? `${patientAge}yo` : null,
                  patientSex,
                  visitDate ? `Visit: ${visitDate}` : null,
                ].filter(Boolean).join(' • ') || 'No patient details'}
              </Text>
            </View>
          </View>
          <View style={styles.patientFields}>
            <TextInput label="PATIENT NAME" placeholder="Name" value={patientName} onChangeText={setPatientName} style={{ flex: 2 }} />
            <TextInput label="AGE" placeholder="Age" keyboardType="number-pad" value={patientAge} onChangeText={setPatientAge} style={{ flex: 1 }} />
          </View>
          <View style={styles.patientFields}>
            <TextInput label="SEX" placeholder="Female / Male" value={patientSex} onChangeText={setPatientSex} style={{ flex: 1 }} />
            <TextInput label="VISIT DATE" placeholder="YYYY-MM-DD" value={visitDate} onChangeText={setVisitDate} style={{ flex: 1 }} />
          </View>
        </Card>

        <Card style={styles.noteCard}>
          <Text style={[typography.bodySemibold, { color: colors.primary, marginBottom: spacing.sm }]}>
            Report
          </Text>
          <TenTapEditor
            ref={editorRef}
            value={noteText}
            onChange={setNoteText}
            macros={macros ?? []}
            placeholder="Your report appears here..."
          />
          <Text style={[typography.caption, { color: colors.muted, marginTop: spacing.xs }]}>
            Tip: type a macro shortcut followed by a space to expand it. Use the toolbar for formatting.
          </Text>
        </Card>

        {note.raw_transcript && note.raw_transcript !== noteText ? (
          <Card style={styles.noteCard}>
            <Text style={[typography.bodySemibold, { color: colors.muted, marginBottom: spacing.sm }]}>
              Original transcript
            </Text>
            {renderTranscript(note.raw_transcript, note.low_confidence_spans)}
            {note.low_confidence_spans && note.low_confidence_spans.length > 0 ? (
              <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs }]}>
                Highlighted phrases were unclear in the audio — verify them before finalizing.
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      {editorBridge ? (
        <View style={styles.toolbarContainer}>
          <Toolbar editor={editorBridge} />
        </View>
      ) : null}

      <View style={[styles.actions, { paddingBottom: Math.max(insetsBottom, 12) }]}>
        <Button label="Finalize Report" onPress={() => persist(true)} disabled={saving} style={{ flex: 1 }} />
        <Button label="Save as Draft" variant="secondary" onPress={() => persist(false)} disabled={saving} style={{ flex: 1 }} />
      </View>
    </KeyboardAvoidingView>
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  patientCard: {
    gap: spacing.md,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientFields: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noteCard: {
    padding: spacing.md,
  },
  toolbarContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 4,
  },
  noteInput: {
    minHeight: 160,
    textAlignVertical: 'top',
  },
  previewWrap: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  previewLabel: {
    color: colors.muted,
  },
  previewBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  transcriptText: {
    color: colors.muted,
  },
  macroList: {
    maxHeight: 240,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
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
  macroExpansion: {
    flex: 1,
    color: colors.text,
  },
  macroDelete: {
    color: colors.muted,
    paddingHorizontal: spacing.xs,
  },
  macroEmpty: {
    color: colors.muted,
  },
  macroForm: {
    flexDirection: 'row',
    gap: spacing.sm,
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
