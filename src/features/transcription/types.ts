export type TranscriptResult = {
  text: string;
  language: string;
};

export type LiveTranscript = {
  text: string;
  /** Full-session audio file (wav) for the retention upload, or null when unavailable. */
  audioUri: string | null;
};

export interface LiveTranscriber {
  readonly name: string;
  start(onText: (fullText: string) => void, onLevel?: (level: number) => void): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<LiveTranscript>;
}