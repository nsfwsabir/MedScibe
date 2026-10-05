import { LiveTranscript, LiveTranscriber } from './types';

export const DEMO_TRANSCRIPT =
  'Patient presents with a persistent dry cough for the past five days. ' +
  'History of mild seasonal allergies; nasal congestion is worse at night. ' +
  'Denies chest pain or shortness of breath. ' +
  'Vitals stable, lungs clear on auscultation. ' +
  'Recommend fluids, rest, and fluticasone nasal spray daily. Follow up in seven days if symptoms persist.';

/**
 * Simulated live dictation for Expo Go: streams the canned transcript
 * word-by-word so the live UI loop is testable without the mic PCM module.
 */
export class FallbackLiveTranscriber implements LiveTranscriber {
  readonly name = 'fallback live (Expo Go)';

  private timer: ReturnType<typeof setInterval> | null = null;
  private words: string[] = [];
  private shown = 0;
  private pausedShown = 0;
  private emit: ((fullText: string) => void) | null = null;

  private currentText(): string {
    return this.words.slice(0, this.pausedShown + this.shown).join(' ');
  }

  async start(onText: (fullText: string) => void): Promise<void> {
    this.words = DEMO_TRANSCRIPT.split(' ');
    this.shown = 0;
    this.pausedShown = 0;
    this.emit = onText;
    this.pump();
  }

  private pump() {
    this.stopPump();
    this.timer = setInterval(() => {
      if (this.pausedShown + this.shown >= this.words.length) {
        this.stopPump();
        return;
      }
      this.shown += 1;
      this.emit?.(this.currentText());
    }, 350);
  }

  private stopPump() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async pause(): Promise<void> {
    this.stopPump();
    this.pausedShown += this.shown;
    this.shown = 0;
  }

  async resume(): Promise<void> {
    if (this.timer || !this.emit) return;
    this.pump();
  }

  async stop(): Promise<LiveTranscript> {
    this.stopPump();
    const text = this.currentText();
    this.emit = null;
    this.shown = 0;
    this.pausedShown = 0;
    return { text, audioUri: null };
  }
}