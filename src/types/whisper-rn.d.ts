declare module 'whisper.rn' {
  export type TranscribeOptions = {
    language?: string;
    translate?: boolean;
    maxThreads?: number;
    nProcessors?: number;
    maxContext?: number;
    maxLen?: number;
    tokenTimestamps?: boolean;
    temperature?: number;
    prompt?: string;
    onProgress?: (progress: number) => void;
  };

  export type TranscribeResult = {
    result: string;
    language: string;
    segments: { text: string; t0: number; t1: number }[];
    isAborted: boolean;
  };
  export type ContextOptions = {
    filePath: string | number;
    isBundleAsset?: boolean;
    useCoreMLIos?: boolean;
    useGpu?: boolean;
    useFlashAttn?: boolean;
  };

  export class WhisperContext {
    transcribe(
      filePathOrBase64: string | number,
      options?: TranscribeOptions,
    ): { stop: () => Promise<void>; promise: Promise<TranscribeResult> };
    release(): Promise<void>;
  }

  export function initWhisper(options: ContextOptions): Promise<WhisperContext>;
  export function releaseAllWhisper(): Promise<void>;
  export const libVersion: string;
}