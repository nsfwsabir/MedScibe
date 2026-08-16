import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, radius, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Waveform } from '../../components/screens/Waveform';
import { BookmarkIcon, MicIcon, PauseIcon, PlayIcon, StopIcon } from '../../components/ui/icons';
import { useRecorder } from '../../features/recording/useRecorder';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'Recording'>;

function formatTime(millis: number): string {
  const totalSeconds = Math.floor(millis / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function RecordingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { noteType } = route.params;
  const recorder = useRecorder(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [stopping, setStopping] = useState(false);

  const handleStop = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    const uri = await recorder.stop();
    const durationSeconds = Math.floor(recorder.durationMillis / 1000);
    if (uri) {
      navigation.replace('Processing', { noteType, durationSeconds, audioUri: uri });
    } else {
      setStopping(false);
      Alert.alert('Recording failed', 'No audio was captured. Please try again.');
    }
  }, [recorder, stopping, navigation, noteType]);

  const handleBack = useCallback(() => {
    const hasAudio = recorder.durationMillis > 3000;
    const discard = () => {
      void recorder.stop();
      recorder.release();
      navigation.goBack();
    };
    if (hasAudio) {
      Alert.alert('Discard recording?', 'This recording will not be saved.', [
        { text: 'Keep recording', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discard },
      ]);
    } else {
      discard();
    }
  }, [recorder, navigation]);

  const isRecording = recorder.status === 'recording';
  const isPaused = recorder.status === 'paused';
  const title = noteType === 'consultation' ? 'Consultation' : 'Quick Dictation';
  const statusLabel = isPaused ? 'PAUSED' : isRecording
    ? noteType === 'consultation'
      ? 'RECORDING LIVE VISIT'
      : 'RECORDING DICTATION'
    : recorder.status === 'starting'
      ? 'PREPARING...'
      : recorder.status === 'error'
        ? 'ERROR'
        : 'STOPPED';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <MicIcon />
        </Pressable>
        <Text style={[typography.title, { color: colors.text }]}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.patientBar}>
        <View>
          <Text style={[typography.bodySemibold, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.caption, { color: colors.muted }]}>
            {recorder.status === 'error' ? recorder.error : 'Hold the phone close to the patient'}
          </Text>
        </View>
        <View style={styles.timerGroup}>
          <Text style={[typography.heading, { color: colors.text }]}>
            {formatTime(recorder.durationMillis)}
          </Text>
          <Text style={[typography.label, { color: isRecording ? colors.primary : colors.muted }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.waveformWrap}>
        <Waveform metering={recorder.metering} active={isRecording} />
      </View>

      <Text style={[typography.body, styles.tip]}>
        {noteType === 'consultation'
          ? 'Discuss the symptoms and history naturally. MedScribe AI filters conversational filler automatically.'
          : 'Summarize the visit in your own words. MedScribe structures it into a SOAP note.'}
      </Text>

      <View style={styles.controlsRow}>
        <Pressable
          style={({ pressed }) => [styles.control, styles.pauseButton, pressed && styles.pressed]}
          onPress={isPaused ? recorder.resume : recorder.pause}
          disabled={!isRecording && !isPaused}
          accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.control, styles.stopButton, pressed && styles.pressed]}
          onPress={handleStop}
          disabled={stopping}
          accessibilityLabel="Stop recording"
        >
          <StopIcon />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.control,
            styles.bookmarkButton,
            bookmarked && styles.bookmarked,
            pressed && styles.pressed,
          ]}
          onPress={() => setBookmarked((b) => !b)}
          accessibilityLabel="Bookmark"
        >
          <BookmarkIcon color={bookmarked ? colors.white : colors.text} />
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />
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
    paddingBottom: spacing.sm,
  },
  patientBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  timerGroup: {
    alignItems: 'flex-end',
    gap: 2,
  },
  waveformWrap: {
    marginTop: spacing.xl,
  },
  tip: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  control: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  stopButton: {
    backgroundColor: colors.primary,
    ...elevation.default,
  },
  bookmarkButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  bookmarked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
});