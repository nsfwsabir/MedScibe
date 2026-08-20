import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { transcriber } from '../../features/transcription';
import { useCreateNote, useUpdateNote } from '../../features/notes/notesQueries';
import { cleanupTranscript } from '../../features/structuring/structureApi';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'Processing'>;

type Step = 'transcribing' | 'cleaning';

function StepRow({ label, state }: { label: string; state: 'active' | 'done' | 'queued' }) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepIcon, state === 'active' && styles.stepIconActive]}>
        {state === 'done' ? (
          <Text style={[typography.bodySemibold, { color: colors.white }]}>✓</Text>
        ) : state === 'active' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={styles.stepDot} />
        )}
      </View>
      <Text style={[typography.bodyMedium, { color: colors.text }]}>{label}</Text>
      {state === 'queued' ? (
        <Text style={[typography.caption, { color: colors.muted }]}>queued</Text>
      ) : null}
    </View>
  );
}

export function ProcessingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { durationSeconds, audioUri } = route.params;
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const [step, setStep] = useState<Step>('transcribing');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const noteIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<string | null>(null);

  const runPipeline = async () => {
    if (!noteIdRef.current) {
      setStep('transcribing');
      await transcriber.ensureModel();
      const result = await transcriber.transcribe(audioUri, setProgress);
      const note = await createNote.mutateAsync({
        status: 'draft',
        visit_date: new Date().toISOString().slice(0, 10),
        raw_transcript: result.text,
        duration_seconds: durationSeconds,
      });
      noteIdRef.current = note.id;
      transcriptRef.current = result.text;
    }
    setStep('cleaning');
    setError(null);
    const cleaned = await cleanupTranscript({ transcript: transcriptRef.current! });
    await updateNote.mutateAsync({
      id: noteIdRef.current!,
      patch: {
        note_text: cleaned.note_text || null,
        low_confidence_spans:
          cleaned.low_confidence_spans.length > 0 ? cleaned.low_confidence_spans : null,
      },
    });
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        await runPipeline();
        navigation.replace('NoteEdit', { id: noteIdRef.current! });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong while processing the audio.');
        console.error('[processing] pipeline failed', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = async () => {
    try {
      await runPipeline();
      navigation.replace('NoteEdit', { id: noteIdRef.current! });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong while cleaning the note.');
      console.error('[processing] cleaning failed', e);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={[typography.heading, styles.title]}>Creating Your Note</Text>

      <Card style={styles.card}>
        <StepRow
          label="Audio transcription complete"
          state={step === 'transcribing' ? 'active' : 'done'}
        />
        {step === 'transcribing' ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={[typography.caption, { color: colors.muted }]}>{progress}%</Text>
          </View>
        ) : null}
        <StepRow label="Cleaning up the dictation..." state={step === 'cleaning' ? 'active' : 'queued'} />
      </Card>

      {step === 'cleaning' ? (
        <View style={styles.footer}>
          <Text style={[typography.bodySemibold, { color: colors.text }]}>Almost there</Text>
          <Text style={[typography.body, styles.footerText]}>
            MedScribe is removing filler words and fixing punctuation so your note is ready to review.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.footer}>
          <Text style={[typography.bodySemibold, { color: colors.error }]}>Processing failed</Text>
          <Text style={[typography.body, styles.footerText]}>{error}</Text>
          <Button label="Retry" variant="secondary" onPress={handleRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  title: {
    color: colors.text,
    marginBottom: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  stepIconActive: {
    backgroundColor: 'transparent',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.xl,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    color: colors.muted,
    textAlign: 'center',
  },
});