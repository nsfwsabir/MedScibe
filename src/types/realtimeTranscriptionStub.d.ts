// Type-only stub for whisper.rn's realtime transcription entry.
//
// Metro resolves 'whisper.rn/realtime-transcription/index' at runtime via the
// package's react-native export condition (TS sources). For typechecking,
// tsconfig paths redirects here instead, because those sources use a `global`
// incompatible with this project's libs and would otherwise be pulled into
// our program. Keep in sync with the usage in realtimeTranscriber.ts.
export type RealtimeTranscribeEvent = {
  type: 'start' | 'transcribe' | 'end' | 'error';
  sliceIndex: number;
  data?: { result: string; language: string };
  isCapturing: boolean;
  processTime: number;
  recordingTime: number;
};

export type RealtimeTranscriberCallbacks = {
  onTranscribe?: (event: RealtimeTranscribeEvent) => void;
  onError?: (error: string) => void;
  onStatusChange?: (isActive: boolean) => void;
};

export type RealtimeOptions = {
  audioSliceSec?: number;
  audioMinSec?: number;
  maxSlicesInMemory?: number;
  transcribeOptions?: { language?: string };
  initialPrompt?: string;
  promptPreviousSlices?: boolean;
  audioOutputPath?: string;
  audioStreamConfig?: {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    audioSource?: number;
    bufferSize?: number;
  };
  realtimeProcessingPauseMs?: number;
  initRealtimeAfterMs?: number;
  logger?: (message: string) => void;
};

export type WavFileWriterFs = {
  writeFile: (filePath: string, data: string, encoding: string) => Promise<void>;
  appendFile: (filePath: string, data: string, encoding: string) => Promise<void>;
  readFile: (filePath: string, encoding: string) => Promise<string>;
  exists: (filePath: string) => Promise<boolean>;
  unlink: (filePath: string) => Promise<void>;
};

export class RealtimeTranscriber {
  constructor(
    dependencies: {
      whisperContext: unknown;
      vadContext?: unknown;
      audioStream: unknown;
      fs?: WavFileWriterFs;
    },
    options?: RealtimeOptions,
    callbacks?: RealtimeTranscriberCallbacks,
  );
  start(): Promise<void>;
  stop(): Promise<void>;
  release(): Promise<void>;
}
