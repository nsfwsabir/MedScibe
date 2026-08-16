import { Transcriber, TranscriptResult } from './types';

const DEMO_TRANSCRIPT =
  'Patient presents with a persistent dry cough for the past five days. ' +
  'History of mild seasonal allergies; nasal congestion is worse at night. ' +
  'Denies chest pain or shortness of breath. ' +
  'Vitals stable, lungs clear on auscultation. ' +
  'Recommend fluids, rest, and fluticasone nasal spray daily. Follow up in seven days if symptoms persist.';

/**
 * Fallback transcriber for Expo Go / web where whisper.rn's native JSI
 * binding cannot run. Returns a canned transcript so the capture loop can be
 * exercised end-to-end before a development build is available.
 */
export class FallbackTranscriber implements Transcriber {
  readonly name = 'fallback (Expo Go)';

  isAvailable(): boolean {
    return true;
  }

  async ensureModel(): Promise<void> {
    console.warn('[transcription] Using fallback transcriber — whisper.rn needs a dev build');
  }

  async transcribe(audioUri: string, onProgress?: (progress: number) => void): Promise<TranscriptResult> {
    for (let p = 10; p <= 90; p += 10) {
      await new Promise((r) => setTimeout(r, 180));
      onProgress?.(p);
    }
    onProgress?.(100);
    return { text: DEMO_TRANSCRIPT, language: 'en' };
  }
}