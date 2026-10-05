// Type-only stub for whisper.rn's PCM audio-stream adapter.
//
// Metro resolves 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter'
// at runtime via the package's react-native export condition (TS sources).
// For typechecking, tsconfig paths redirects here instead, because those
// sources use a `global` incompatible with this project's libs and would
// otherwise be pulled into our program. Keep in sync with the adapter's
// AudioStreamInterface usage in realtimeTranscriber.ts.
export class AudioPcmStreamAdapter {
  initialize(config: {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    audioSource?: number;
    bufferSize?: number;
  }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  release(): Promise<void>;
}
