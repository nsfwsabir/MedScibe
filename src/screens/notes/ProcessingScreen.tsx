import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { transcriber } from '../../features/transcription';
import { useCreateNote, useUpdateNote } from '../../features/notes/notesQueries';
import { cleanupTranscript } from '../../features/structuring/structureApi';
import { macrosKeys } from '../../features/macros/macrosQueries';
import { fetchMacros } from '../../features/macros/macrosApi';
import { expandMacros } from '../../features/macros/expansion';
import { uploadAudio, type UploadResult } from '../../features/audio/audioApi';
import { useSettingsStore } from '../../features/settings/settingsStore';
import { logAudit } from '../../features/audit/auditApi';
import { enqueuePendingNote } from '../../features/offline/pendingNotes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'Processing'>;

type Step = 'downloading' | 'transcribing' | 'cleaning';

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
  const queryClient = useQueryClient();
  const { durationSeconds, audioUri } = route.params;
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const [step, setStep] = useState<Step>('transcribing');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<Step | null>(null);
  const startedRef = useRef(false);
  const noteIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<string | null>(null);
  const audioRef = useRef<UploadResult | null>(null);

  const formatError = (e: unknown, fallback: string): string => {
    const raw = e instanceof Error ? e.message : String(e ?? fallback);
    // Surface the real cause instead of generic "cleaning failed". Keep it
    // short for the UI but include enough to diagnose model/WAV/network.
    if (!raw || raw === fallback) return fallback;
    // Truncate very long Groq/Supabase error JSON
    return raw.length > 600 ? raw.slice(0, 600) + '…' : raw;
  };

  const runPipeline = async () => {
    const { retainOriginalAudio, retentionDays } = useSettingsStore.getState();

    if (!noteIdRef.current) {
      // Stage 1: ensure model (shows downloading progress if needed)
      setStep('downloading');
      setErrorStage(null);
      setProgress(0);
      try {
        await transcriber.ensureModel((p) => setProgress(Math.round(p)));
      } catch (e) {
        // Model DL can fail on flaky mobile data (Hugging Face 140 MB).
        // WhisperTranscriber will fallback to cloud/demo, so don't hard-fail
        // here — just log and continue to transcription where the fallback
        // actually runs. Only fail if it's clearly a storage permission error.
        console.warn('[processing] ensureModel failed, continuing to transcribe fallback', e);
        const msg = e instanceof Error ? e.message : String(e);
        const isStorage = /storage|permission|ENOSPC/i.test(msg);
        if (isStorage) throw e;
      }
      // Stage 2: transcription
      setStep('transcribing');
      setErrorStage('transcribing');
      setProgress(0);
      let result: { text: string; language: string };
      try {
        result = await transcriber.transcribe(audioUri, setProgress);
      } catch (e) {
        // WhisperTranscriber now never throws Invalid WAV — it falls back to
        // demo, but keep this catch for unexpected errors so we can show
        // the true cause instead of generic "cleaning" message.
        throw new Error(formatError(e, 'Transcription failed. Check audio format and internet, then Retry.'));
      }
      if (!result.text || !result.text.trim()) {
        throw new Error('Transcription returned empty text. Try recording a longer, louder dictation.');
      }
      transcriptRef.current = result.text;
      let noteId: string;
      try {
        const note = await createNote.mutateAsync({
          status: 'draft',
          visit_date: new Date().toISOString().slice(0, 10),
          raw_transcript: result.text,
          duration_seconds: durationSeconds,
        });
        noteId = note.id;
        void logAudit(note.id, 'create');
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        const isNetwork = /network|fetch|Failed to fetch|offline/i.test(msg);
        if (isNetwork) {
          await enqueuePendingNote(
            {
              status: 'draft',
              visit_date: new Date().toISOString().slice(0, 10),
              raw_transcript: result.text,
              duration_seconds: durationSeconds,
            },
            audioUri,
            durationSeconds,
          );
          throw new Error('You appear to be offline. Note saved locally and will sync when online.');
        }
        throw new Error(formatError(e, 'Could not save note — check Supabase connectivity.'));
      }
      noteIdRef.current = noteId;
      // Upload original audio if retention is enabled (non-blocking for cleaning if it fails)
      try {
        audioRef.current = await uploadAudio({
          audioUri,
          noteId,
          retainOriginalAudio,
          retentionDays,
        });
      } catch {
        audioRef.current = { audio_path: null, audio_retention_until: null };
      }
    } else if (retainOriginalAudio && !audioRef.current?.audio_path) {
      // Retry case: transcription already done but audio upload failed previously
      try {
        audioRef.current = await uploadAudio({
          audioUri,
          noteId: noteIdRef.current,
          retainOriginalAudio,
          retentionDays,
        });
      } catch {
        audioRef.current = { audio_path: null, audio_retention_until: null };
      }
    }
    setStep('cleaning');
    setErrorStage('cleaning');
    setError(null);
    let cleaned: { note_text: string; low_confidence_spans: string[] };
    try {
      cleaned = await cleanupTranscript({ transcript: transcriptRef.current! });
    } catch (e) {
      console.warn('[processing] cleanup failed, using raw transcript fallback', e);
      cleaned = { note_text: transcriptRef.current!, low_confidence_spans: [] };
    }
    // Auto-expand quick macros in the cleaned dictation (Augnito-style).
    let macroList: Awaited<ReturnType<typeof fetchMacros>> = [];
    try {
      macroList = await queryClient.ensureQueryData({
        queryKey: macrosKeys.all,
        queryFn: fetchMacros,
      });
    } catch (e) {
      console.warn('[processing] macros fetch failed, continuing without expansion', e);
    }
    const patch: Record<string, unknown> = {
      note_text: expandMacros(cleaned.note_text || '', macroList) || null,
      low_confidence_spans: cleaned.low_confidence_spans.length > 0 ? cleaned.low_confidence_spans : null,
    };
    if (audioRef.current?.audio_path) {
      (patch as any).audio_path = audioRef.current.audio_path;
      (patch as any).audio_retention_until = audioRef.current.audio_retention_until;
    } else if (!retainOriginalAudio) {
      (patch as any).audio_path = null;
      (patch as any).audio_retention_until = null;
    }
    try {
      await updateNote.mutateAsync({
        id: noteIdRef.current!,
        patch: patch as any,
      });
    } catch (e) {
      throw new Error(formatError(e, 'Could not finalize note. Check connection and Retry.'));
    }
    void logAudit(noteIdRef.current!, 'update');
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        await runPipeline();
        navigation.replace('NoteEdit', { id: noteIdRef.current! });
      } catch (e) {
        setError(formatError(e, 'Something went wrong while processing the audio.'));
        console.error('[processing] pipeline failed at', errorStage, e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = async () => {
    setError(null);
    try {
      await runPipeline();
      navigation.replace('NoteEdit', { id: noteIdRef.current! });
    } catch (e) {
      setError(formatError(e, 'Something went wrong while cleaning the note.'));
      console.error('[processing] retry failed at', errorStage, e);
    }
  };

  const isFallback = transcriber.name.includes('fallback');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={[typography.heading, styles.title]}>Creating Your Note</Text>
      {isFallback ? (
        <View style={styles.fallbackBanner}>
          <Text style={[typography.caption, { color: colors.muted }]}>
            Running in Expo Go — transcription uses a demo note. Use a development build for on-device Whisper.
          </Text>
        </View>
      ) : null}

      <Card style={styles.card}>
        <StepRow
          label={step === 'downloading' ? 'Downloading model...' : 'Audio transcription'}
          state={step === 'downloading' || step === 'transcribing' ? 'active' : 'done'}
        />
        {step === 'downloading' || step === 'transcribing' ? (
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
  fallbackBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
});