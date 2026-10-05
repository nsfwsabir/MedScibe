declare module '@fugood/react-native-audio-pcm-stream' {
  export type PcmStreamOptions = {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    audioSource?: number;
    wavFile: string;
    bufferSize?: number;
  };

  const AudioRecord: {
    init: (options: PcmStreamOptions) => Promise<void>;
    start: () => void;
    stop: () => void;
    on: (event: 'data', callback: (base64: string) => void) => void;
  };

  export default AudioRecord;
}
