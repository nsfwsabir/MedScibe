import React, { ReactNode, useRef, useState } from 'react';
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
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useNote, useUpdateNote } from '../../features/notes/notesQueries';
import { Note } from '../../features/notes/notesApi';
import { applyFormat, FormatAction, RichText } from '../../features/notes/formatting';
import { useMacros, useCreateMacro, useDeleteMacro } from '../../features/macros/macrosQueries';
import { normalizeShortcut, validateMacro } from '../../features/macros/macrosApi';
import { tryExpandAtCaret } from '../../features/macros/expansion';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NoteEdit'>;
type Selection = { start: number; end: number };

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
        <Text style={[typography.body, { color: colors.muted }]}>Loading note...</Text>
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

  const selectionRef = useRef<Selection>({ start: noteText.length, end: noteText.length });
  const [forcedSelection, setForcedSelection] = useState<Selection | null>(null);
  const expandingRef = useRef(false);

  const { data: macros } = useMacros();
  const [macrosOpen, setMacrosOpen] = useState(false);
  const [macroShortcut, setMacroShortcut] = useState('');
  const [macroExpansion, setMacroExpansion] = useState('');
  const [macroError, setMacroError] = useState<string | null>(null);
  const createMacroM = useCreateMacro();
  const deleteMacroM = useDeleteMacro();

  // One-shot caret control: RN TextInputs can't be imperatively positioned,
  // so we pass `selection` briefly after programmatic edits and clear it as
  // soon as the platform confirms the caret moved (plus a safety timeout).
  const applyForcedSelection = (sel: Selection) => {
    setForcedSelection(sel);
    setTimeout(() => {
      setForcedSelection((cur) => (cur === sel ? null : cur));
    }, 400);
  };

  const handleSelectionChange = (e: { nativeEvent: { selection: Selection } }) => {
    // While a programmatic edit is settling, Android reports transient caret
    // positions (often 0,0). Trust our intended selection instead, and stop
    // forcing as soon as the platform reports it.
    if (forcedSelection !== null) {
      const sel = e.nativeEvent.selection;
      if (sel.start === forcedSelection.start && sel.end === forcedSelection.end) {
        setForcedSelection(null);
      }
      return;
    }
    selectionRef.current = e.nativeEvent.selection;
  };

  const handleChangeText = (text: string) => {
    if (expandingRef.current) {
      expandingRef.current = false;
      setNoteText(text);
      return;
    }
    const res = tryExpandAtCaret(text, selectionRef.current.end, macros ?? []);
    if (res) {
      expandingRef.current = true;
      setNoteText(res.text);
      const caret = { start: res.caret, end: res.caret };
      selectionRef.current = caret;
      applyForcedSelection(caret);
      return;
    }
    setNoteText(text);
  };

  const format = (action: FormatAction) => {
    const res = applyFormat(noteText, selectionRef.current, action);
    if (res.text !== noteText) expandingRef.current = true;
    setNoteText(res.text);
    selectionRef.current = res.selection;
    applyForcedSelection(res.selection);
  };

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
      setMacroError(
        /duplicate|unique/i.test(message) ? 'That shortcut already exists.' : message,
      );
    }
  };

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
        <Text style={[typography.title, { color: colors.text }]}>Edit Note</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.patientCard}>
          <View style={styles.patientRow}>
            <View style={styles.avatar}>
              <Text style={[typography.bodySemibold, { color: colors.white }]}>{initials}</Text>
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
            Note
          </Text>
          <View style={styles.toolbar}>
            {TOOLBAR_ACTIONS.map(({ action, label, style }) => (
              <Pressable key={action} onPress={() => format(action)} style={styles.toolButton} hitSlop={4}>
                <Text style={[typography.bodySemibold, styles.toolLabel, style]}>{label}</Text>
              </Pressable>
            ))}
            <View style={styles.toolbarDivider} />
            <Pressable onPress={() => setMacrosOpen(true)} style={styles.macrosButton} hitSlop={4}>
              <Text style={[typography.label, styles.macrosLabel]}>MACROS</Text>
            </Pressable>
          </View>
          <TextInput
            placeholder="Your dictation appears here..."
            multiline
            value={noteText}
            onChangeText={handleChangeText}
            onSelectionChange={handleSelectionChange}
            selection={forcedSelection ?? undefined}
            style={styles.noteInput}
          />
          <Text style={[typography.caption, { color: colors.muted, marginTop: spacing.xs }]}>
            Tip: type a macro shortcut followed by a space to expand it.
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

      <BottomSheet visible={macrosOpen} onClose={() => setMacrosOpen(false)}>
        <Text style={[typography.title, { color: colors.text }]}>Quick Macros</Text>
        <Text style={[typography.caption, { color: colors.muted }]}>
          A macro expands into your full text the moment you type its shortcut and a space — while
          editing here or right after dictation is cleaned up.
        </Text>

        {(macros ?? []).length > 0 ? (
          <ScrollView style={styles.macroList} nestedScrollEnabled>
            {(macros ?? []).map((m) => (
              <View key={m.id} style={styles.macroRow}>
                <View style={styles.macroShortcutWrap}>
                  <Text style={[typography.bodySemibold, styles.macroShortcut]} numberOfLines={1}>
                    {m.shortcut}
                  </Text>
                </View>
                <RichText value={m.expansion} baseStyle={styles.macroExpansion} />
                <Pressable
                  hitSlop={8}
                  disabled={deleteMacroM.isPending}
                  onPress={() => deleteMacroM.mutate(m.id)}
                >
                  <Text style={[typography.bodyMedium, styles.macroDelete]}>✕</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={[typography.body, styles.macroEmpty]}>
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
        {macroError ? (
          <Text style={[typography.caption, { color: colors.error }]}>{macroError}</Text>
        ) : null}
        <Button
          label="Add Macro"
          variant="secondary"
          onPress={handleAddMacro}
          disabled={createMacroM.isPending}
        />
      </BottomSheet>

      <View style={[styles.actions, { paddingBottom: Math.max(insetsBottom, 12) }]}>
        <Button label="Finalize Note" onPress={() => persist(true)} disabled={saving} style={{ flex: 1 }} />
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
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
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
    backgroundColor: colors.primary,
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  toolButton: {
    width: 40,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    color: colors.primary,
  },
  toolBold: {
    fontWeight: '800',
  },
  toolItalic: {
    fontStyle: 'italic',
  },
  toolUnderline: {
    textDecorationLine: 'underline',
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  macrosButton: {
    height: 36,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macrosLabel: {
    color: colors.white,
  },
  noteInput: {
    minHeight: 160,
    textAlignVertical: 'top',
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

const TOOLBAR_ACTIONS: { action: FormatAction; label: string; style?: object }[] = [
  { action: 'bold', label: 'B', style: styles.toolBold },
  { action: 'italic', label: 'I', style: styles.toolItalic },
  { action: 'underline', label: 'U', style: styles.toolUnderline },
  { action: 'h1', label: 'H1' },
  { action: 'h2', label: 'H2' },
];
