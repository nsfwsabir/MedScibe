export type TranscriptResult = {
  text: string;
  language: string;
};

export interface Transcriber {
  /** Human-readable name of the active transcription engine. */
  readonly name: string;
  /** Returns true when the engine can actually run in this build. */
  isAvailable(): boolean;
  /** Ensure any required model/weights are present. Throws on failure. */
  ensureModel(onProgress?: (progress: number) => void): Promise<void>;
  /** Transcribe an audio file. `onProgress` receives 0..100. */
  transcribe(audioUri: string, onProgress?: (progress: number) => void): Promise<TranscriptResult>;
}

export type LiveTranscript = {
  text: string;
  /** Full-session audio file (wav) for the retention upload, or null when unavailable. */
  audioUri: string | null;
};

/**
 * On-the-spot dictation: text streams via `onText` while recording.
 * `stop()` drains in-flight slices and returns the complete transcript.
 * Pause keeps accumulated text; resume continues appending to it.
 */
export interface LiveTranscriber {
  readonly name: string;
  start(onText: (fullText: string) => void): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<LiveTranscript>;
}