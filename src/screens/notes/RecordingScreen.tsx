import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { colors, elevation, radius, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Waveform } from '../../components/screens/Waveform';
import { MicIcon, PauseIcon, PlayIcon, StopIcon } from '../../components/ui/icons';
import { createLiveSession } from '../../features/transcription';
import type { LiveTranscriber } from '../../features/transcription/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'Recording'>;

type Status = 'starting' | 'live' | 'paused' | 'stopping' | 'error';

function formatTime(millis: number): string {
  const totalSeconds = Math.floor(millis / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function RecordingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const sessionRef = useRef<LiveTranscriber | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [error, setError] = useState<string | null>(null);
  const [liveText, setLiveText] = useState('');
  const [elapsedMillis, setElapsedMillis] = useState(0);
  const [stopping, setStopping] = useState(false);

  // Elapsed timer — ticks only while live.
  useEffect(() => {
    if (status !== 'live') return;
    const interval = setInterval(() => setElapsedMillis((m) => m + 250), 250);
    return () => clearInterval(interval);
  }, [status]);

  // Start the live session on mount; tear it down on unmount.
  useEffect(() => {
    let cancelled = false;
    const session = createLiveSession();
    sessionRef.current = session;
    (async () => {
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) throw new Error('Microphone permission was not granted.');
        await session.start((text) => {
          if (!cancelled) setLiveText(text);
        });
        if (!cancelled) setStatus('live');
      } catch (e) {
        if (!cancelled) {
          console.warn(
            '[live] session start failed:',
            e instanceof Error ? e.stack ?? e.message : String(e),
          );
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Could not start live dictation.');
        }
      }
    })();
    return () => {
      cancelled = true;
      void session.stop().catch(() => undefined);
    };
  }, []);

  // Keep the transcript pinned to the latest words.
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [liveText]);

  const handlePause = useCallback(async () => {
    try {
      await sessionRef.current?.pause();
      setStatus('paused');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not pause.');
    }
  }, []);

  const handleResume = useCallback(async () => {
    try {
      await sessionRef.current?.resume();
      setStatus('live');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not resume.');
    }
  }, []);

  const handleStop = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    setStatus('stopping');
    try {
      const result = await sessionRef.current?.stop();
      sessionRef.current = null;
      const text = result?.text?.trim() ?? '';
      if (!text) {
        setStopping(false);
        setStatus('live');
        Alert.alert('Nothing captured', 'No speech was detected. Keep dictating, then stop.');
        // Re-arm a fresh session so dictation can continue.
        const session = createLiveSession();
        sessionRef.current = session;
        try {
          await session.start((t) => setLiveText(t));
        } catch {
          setStatus('error');
        }
        return;
      }
      navigation.replace('Processing', {
        durationSeconds: Math.floor(elapsedMillis / 1000),
        audioUri: result?.audioUri ?? null,
        transcript: text,
      });
    } catch (e) {
      setStopping(false);
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not finish dictation.');
    }
  }, [stopping, navigation, elapsedMillis]);

  const handleBack = useCallback(() => {
    const discard = () => {
      void sessionRef.current?.stop().catch(() => undefined);
      sessionRef.current = null;
      navigation.goBack();
    };
    if (liveText.trim().length > 0) {
      Alert.alert('Discard dictation?', 'The live transcript will not be saved.', [
        { text: 'Keep dictating', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discard },
      ]);
    } else {
      discard();
    }
  }, [liveText, navigation]);

  const isLive = status === 'live';
  const isPaused = status === 'paused';
  const statusLabel =
    status === 'live'
      ? 'LISTENING'
      : status === 'paused'
        ? 'PAUSED'
        : status === 'starting'
          ? 'PREPARING...'
          : status === 'stopping'
            ? 'FINISHING...'
            : 'ERROR';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <MicIcon />
        </Pressable>
        <Text style={[typography.title, { color: colors.text }]}>New Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.patientBar}>
        <View style={{ flex: 1, flexShrink: 1, marginRight: spacing.sm }}>
          <Text style={[typography.bodySemibold, { color: colors.text }]}>Live Dictation</Text>
          <Text style={[typography.caption, { color: colors.muted }]} numberOfLines={2}>
            {status === 'error' ? error : 'Speak naturally — your report appears below as you talk'}
          </Text>
        </View>
        <View style={[styles.timerGroup, { flexShrink: 0 }]}>
          <Text style={[typography.heading, { color: colors.text }]}>{formatTime(elapsedMillis)}</Text>
          <Text
            style={[typography.label, { color: isLive ? colors.primary : colors.muted, textAlign: 'right' }]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.waveformWrap}>
        <Waveform active={isLive} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.transcriptBox}
        contentContainerStyle={styles.transcriptContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[typography.body, { color: liveText ? colors.text : colors.muted }]}>
          {liveText || 'Listening…'}
        </Text>
      </ScrollView>

      <View style={styles.controlsRow}>
        <Pressable
          style={({ pressed }) => [styles.control, styles.pauseButton, pressed && styles.pressed]}
          onPress={isPaused ? handleResume : handlePause}
          disabled={!isLive && !isPaused}
          accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? <PlayIcon color={colors.primary} /> : <PauseIcon color={colors.primary} />}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.control, styles.stopButton, pressed && styles.pressed]}
          onPress={handleStop}
          disabled={stopping || (!isLive && !isPaused)}
          accessibilityLabel="Stop dictation"
        >
          <StopIcon />
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
    gap: spacing.sm,
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
    marginTop: spacing.lg,
  },
  transcriptBox: {
    marginTop: spacing.md,
    maxHeight: 220,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  transcriptContent: {
    paddingBottom: spacing.sm,
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
    backgroundColor: colors.primaryFocusRing,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stopButton: {
    backgroundColor: colors.primary,
    ...elevation.default,
  },
  pressed: {
    opacity: 0.85,
  },
});
