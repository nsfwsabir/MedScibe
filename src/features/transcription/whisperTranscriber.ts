import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Transcriber, TranscriptResult } from './types';

const MODEL_URL =
  process.env.EXPO_PUBLIC_WHISPER_MODEL_URL ??
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
const MODEL_FILENAME = MODEL_URL.split('/').pop() ?? 'ggml-base.bin';

/**
 * On-device transcription via whisper.rn (whisper.cpp bindings).
 * Requires a development build — this module must never be imported in Expo Go,
 * since the native JSI binding is absent there.
 */
export class WhisperTranscriber implements Transcriber {
  readonly name = 'whisper.rn';

  isAvailable(): boolean {
    return Constants.appOwnership !== 'expo';
  }

  private async modelPath(onProgress?: (progress: number) => void): Promise<string> {
    const dir = FileSystem.cacheDirectory + 'whisper/';
    const file = dir + MODEL_FILENAME;
    const info = await FileSystem.getInfoAsync(file);
    if (info.exists) return file;

    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    console.log(`[whisper] downloading ${MODEL_FILENAME} (${MODEL_URL})`);
    const callback = (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
      if (progress.totalBytesExpectedToWrite > 0 && onProgress) {
        const pct = Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
        onProgress(Math.min(99, pct));
      }
    };
    const dl = FileSystem.createDownloadResumable(MODEL_URL, file, {}, callback);
    const result = await dl.downloadAsync();
    if (!result || result.status !== 200) {
      await FileSystem.deleteAsync(file, { idempotent: true });
      throw new Error(`Whisper model download failed (HTTP ${result?.status ?? 0})`);
    }
    onProgress?.(100);
    return file;
  }

  async ensureModel(onProgress?: (progress: number) => void): Promise<void> {
    await this.modelPath(onProgress);
  }

  async transcribe(audioUri: string, onProgress?: (progress: number) => void): Promise<TranscriptResult> {
    const { initWhisper } = await import('whisper.rn');
    const filePath = await this.modelPath();

    const context = await initWhisper({ filePath });
    try {
      const { promise } = context.transcribe(audioUri, {
        language: 'auto',
        onProgress: onProgress,
      });
      const result = await promise;
      return { text: result.result.trim(), language: result.language };
    } finally {
      await context.release();
    }
  }
}