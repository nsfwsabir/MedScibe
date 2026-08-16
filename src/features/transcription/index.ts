import Constants from 'expo-constants';
import { Transcriber } from './types';
import { FallbackTranscriber } from './fallbackTranscriber';
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