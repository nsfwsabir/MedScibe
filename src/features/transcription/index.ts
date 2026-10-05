import Constants from 'expo-constants';
import { LiveTranscriber } from './types';
import { CloudLiveTranscriber } from './cloudLiveTranscriber';
import { FallbackLiveTranscriber } from './fallbackTranscriber';

/**
 * Fresh live-dictation session (native state per session — never a singleton).
 * - Dev builds: cloud large-v3-turbo over chunked mic audio.
 * - Expo Go: no mic PCM module → simulated streaming demo transcript.
 */
export function createLiveSession(): LiveTranscriber {
  const isExpoGo = Constants.appOwnership === 'expo';
  return isExpoGo ? new FallbackLiveTranscriber() : new CloudLiveTranscriber();
}

export { TranscriptResult } from './types';
