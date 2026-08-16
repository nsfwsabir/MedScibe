import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { useNote, useUpdateNote } from '../../features/notes/notesQueries';
import { Note } from '../../features/notes/notesApi';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'NoteEdit'>;

const soapFields: { key: 'subjective' | 'objective' | 'assessment' | 'plan'; label: string }[] = [
  { key: 'subjective', label: 'Subjective (S)' },
  { key: 'objective', label: 'Objective (O)' },
  { key: 'assessment', label: 'Assessment (A)' },
  { key: 'plan', label: 'Plan (P)' },
];

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
  const [soap, setSoap] = useState<Record<string, string>>({
    subjective: note?.subjective ?? '',
    objective: note?.objective ?? '',
    assessment: note?.assessment ?? '',
    plan: note?.plan ?? '',
  });
  const [saving, setSaving] = useState(false);

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
          subjective: soap.subjective || null,
          objective: soap.objective || null,
          assessment: soap.assessment || null,
          plan: soap.plan || null,
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
        <Text style={[typography.title, { color: colors.text }]}>Edit Draft Note</Text>
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

        {soapFields.map((field) => (
          <Card key={field.key} style={styles.soapCard}>
            <Text style={[typography.bodySemibold, { color: colors.primary, marginBottom: spacing.sm }]}>
              {field.label}
            </Text>
            <TextInput
              placeholder="Type or edit content..."
              multiline
              value={soap[field.key]}
              onChangeText={(t) => setSoap((prev) => ({ ...prev, [field.key]: t }))}
              style={styles.soapInput}
            />
          </Card>
        ))}

        {note.raw_transcript ? (
          <Card style={styles.soapCard}>
            <Text style={[typography.bodySemibold, { color: colors.muted, marginBottom: spacing.sm }]}>
              Transcript
            </Text>
            <Text style={[typography.body, styles.transcriptText]}>{note.raw_transcript}</Text>
          </Card>
        ) : null}
      </ScrollView>

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
  soapCard: {
    padding: spacing.md,
  },
  soapInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  transcriptText: {
    color: colors.muted,
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
