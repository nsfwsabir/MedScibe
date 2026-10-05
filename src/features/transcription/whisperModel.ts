import * as FileSystem from 'expo-file-system/legacy';

export const WHISPER_MODEL_URL =
  process.env.EXPO_PUBLIC_WHISPER_MODEL_URL ??
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
export const WHISPER_MODEL_FILENAME = WHISPER_MODEL_URL.split('/').pop() ?? 'ggml-base.bin';

/** Silero VAD model for live speech slicing (small, ~2 MB). Overridable via env. */
export const VAD_MODEL_URL =
  process.env.EXPO_PUBLIC_VAD_MODEL_URL ??
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-silero-v6.2.0.bin';
export const VAD_MODEL_FILENAME = VAD_MODEL_URL.split('/').pop() ?? 'ggml-silero-v6.2.0.bin';

async function downloadFile(url: string, filename: string, onProgress?: (progress: number) => void): Promise<string> {
  const dir = FileSystem.cacheDirectory + 'whisper/';
  const file = dir + filename;
  const info = await FileSystem.getInfoAsync(file);
  if (info.exists) return file;

  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  console.log(`[whisper] downloading ${filename} (${url})`);
  const callback = (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
    if (progress.totalBytesExpectedToWrite > 0 && onProgress) {
      const pct = Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
      onProgress(Math.min(99, pct));
    }
  };
  const dl = FileSystem.createDownloadResumable(url, file, {}, callback);
  const result = await dl.downloadAsync();
  if (!result || result.status !== 200) {
    await FileSystem.deleteAsync(file, { idempotent: true });
    throw new Error(`Model download failed (HTTP ${result?.status ?? 0}). Check internet & storage.`);
  }
  onProgress?.(100);
  return file;
}

/** Local path to the transcription model, downloading it on first use. */
export function whisperModelPath(onProgress?: (progress: number) => void): Promise<string> {
  return downloadFile(WHISPER_MODEL_URL, WHISPER_MODEL_FILENAME, onProgress);
}

/** Local path to the VAD model. Throws when offline — callers fall back to time slicing. */
export function vadModelPath(onProgress?: (progress: number) => void): Promise<string> {
  return downloadFile(VAD_MODEL_URL, VAD_MODEL_FILENAME, onProgress);
}
