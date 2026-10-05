import { Buffer } from 'buffer';
import LiveAudioStream from '@fugood/react-native-audio-pcm-stream';

export type AudioPcmStream = {
  initialize(config: { sampleRate?: number; channels?: number; bitsPerSample?: number }): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onData(callback: (data: Uint8Array) => void): void;
  onError(callback: (error: string) => void): void;
};

/** Thin wrapper over the native PCM mic stream (16 kHz mono frames as base64). */
export function createAudioPcmStream(): AudioPcmStream {
  let errorCallback: ((error: string) => void) | null = null;
  return {
    async initialize(config) {
      try {
        await LiveAudioStream.init({
          sampleRate: config.sampleRate ?? 16000,
          channels: config.channels ?? 1,
          bitsPerSample: config.bitsPerSample ?? 16,
          audioSource: 6,
          bufferSize: 16 * 1024,
          wavFile: '',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Microphone stream failed to start.';
        errorCallback?.(msg);
        throw new Error(msg);
      }
    },
    async start() {
      LiveAudioStream.start();
    },
    async stop() {
      try {
        LiveAudioStream.stop();
      } catch {}
    },
    onData(callback) {
      LiveAudioStream.on('data', (base64: string) => {
        try {
          callback(new Uint8Array(Buffer.from(base64, 'base64')));
        } catch (e) {
          errorCallback?.(e instanceof Error ? e.message : 'Audio decode failed.');
        }
      });
    },
    onError(callback) {
      errorCallback = callback;
    },
  };
}
