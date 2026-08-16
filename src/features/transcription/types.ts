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
  ensureModel(): Promise<void>;
  /** Transcribe an audio file. `onProgress` receives 0..100. */
  transcribe(audioUri: string, onProgress?: (progress: number) => void): Promise<TranscriptResult>;
}