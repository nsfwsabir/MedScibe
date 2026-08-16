import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioRecorder, RecorderState, RecordingOptions } from 'expo-audio';

export type RecorderStatus = 'starting' | 'recording' | 'paused' | 'stopped' | 'error';

const POLL_INTERVAL_MS = 200;

const RECORDER_OPTIONS: Partial<RecordingOptions> = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

let sharedRecorder: AudioRecorder | null = null;
let sharedStarted = false;

function acquireRecorder(): AudioRecorder | null {
  if (!sharedRecorder) {
    try {
      // eslint-disable-next-line import/namespace
      sharedRecorder = new AudioModule.AudioRecorder(RECORDER_OPTIONS);
    } catch {
      return null;
    }
  }
  return sharedRecorder;
}

function disposeRecorder() {
  const recorder = sharedRecorder;
  sharedRecorder = null;
  sharedStarted = false;
  if (!recorder) return;
  try {
    recorder.stop().catch(() => undefined);
  } catch {
    // recorder was already released on the native side
  }
  try {
    void recorder.release();
  } catch {
    // already released
  }
}

const EMPTY_STATE: RecorderState = {
  canRecord: false,
  isRecording: false,
  durationMillis: 0,
  mediaServicesDidReset: false,
  url: null,
};

export function useRecorder(autoStart = false) {
  const recorderRef = useRef<AudioRecorder | null>(null);
  const [status, setStatus] = useState<RecorderStatus>('stopped');
  const [error, setError] = useState<string | null>(null);
  const [recorderState, setRecorderState] = useState<RecorderState>(EMPTY_STATE);
  const [uri, setUri] = useState<string | null>(null);

  const getRecorder = useCallback((): AudioRecorder | null => {
    if (!recorderRef.current) {
      recorderRef.current = acquireRecorder();
    }
    return recorderRef.current;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const recorder = recorderRef.current ?? sharedRecorder;
      if (!recorder) return;
      try {
        const next = recorder.getStatus();
        setRecorderState((prev) =>
          prev.isRecording === next.isRecording &&
          prev.durationMillis === next.durationMillis &&
          prev.metering === next.metering
            ? prev
            : next,
        );
        if (next.isRecording) {
          setStatus((prev) => (prev === 'recording' ? prev : 'recording'));
        }
      } catch {
        sharedRecorder = null;
        recorderRef.current = null;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const start = useCallback(async () => {
    if (sharedStarted) {
      setStatus('recording');
      return;
    }
    const recorder = getRecorder();
    if (!recorder) {
      setStatus('error');
      setError('Could not initialize the recorder.');
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setStatus('error');
        setError('Microphone permission was not granted.');
        return;
      }
      setStatus('starting');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      sharedStarted = true;
      setStatus('recording');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not start recording.');
    }
  }, [getRecorder]);

  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(() => {
      void start();
    }, 0);
    return () => clearTimeout(timer);
  }, [autoStart, start]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current ?? sharedRecorder;
    if (status !== 'recording' || !recorder) return;
    try {
      recorder.pause();
      setStatus('paused');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not pause recording.');
    }
  }, [status]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current ?? sharedRecorder;
    if (status !== 'paused' || !recorder) return;
    try {
      recorder.record();
      setStatus('recording');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not resume recording.');
    }
  }, [status]);

  const stop = useCallback(async (): Promise<string | null> => {
    const recorder = recorderRef.current ?? sharedRecorder;
    if (!recorder) return null;
    try {
      await recorder.stop();
      sharedStarted = false;
      const stoppedUri = recorder.uri;
      setUri(stoppedUri);
      setStatus('stopped');
      return stoppedUri;
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not stop recording.');
      return null;
    }
  }, []);

  const release = useCallback(() => {
    recorderRef.current = null;
    disposeRecorder();
  }, []);

  return useMemo(
    () => ({
      status,
      error,
      isRecording: recorderState.isRecording,
      durationMillis: recorderState.durationMillis,
      metering: recorderState.metering,
      uri,
      start,
      pause,
      resume,
      stop,
      release,
    }),
    [status, error, recorderState, uri, start, pause, resume, stop, release],
  );
}