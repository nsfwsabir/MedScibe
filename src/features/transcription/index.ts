import Constants from 'expo-constants';
import { LiveTranscriber, Transcriber } from './types';
import { FallbackLiveTranscriber, FallbackTranscriber } from './fallbackTranscriber';
import { WhisperLiveTranscriber } from './realtimeTranscriber';
import { WhisperTranscriber } from './whisperTranscriber';

/**
 * Pick the transcription engine for the current runtime.
 * - Expo Go: no native JSI bindings → fallback transcriber (canned transcript).
 * - Development build: whisper.rn on-device transcription.
 */
function selectTranscriber(): Transcriber {
  const ownership = Constants.appOwnership;
  const isExpoGo = ownership === 'expo';
  if (isExpoGo) {
    return new FallbackTranscriber();
  }
  return new WhisperTranscriber();
}

export const transcriber: Transcriber = selectTranscriber();
export { TranscriptResult } from './types';

/** Fresh live-dictation session (native state per session — never a singleton). */
export function createLiveSession(): LiveTranscriber {
  const isExpoGo = Constants.appOwnership === 'expo';
  return isExpoGo ? new FallbackLiveTranscriber() : new WhisperLiveTranscriber();
}