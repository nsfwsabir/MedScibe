import { NativeModules } from 'react-native';
import { NativeModulesProxy } from 'expo-modules-core';

// App's AudioConverter is registered via MainApplication.kt (com.medscribe.app.AudioConverterPackage)
// Expo autolinking for file:modules/audio-converter is not used for native; JS just proxies to NativeModules
const NativeAudioConverter: any =
  (NativeModules as any).AudioConverter ??
  (NativeModulesProxy as any).AudioConverter ??
  (globalThis as any).NativeModules?.AudioConverter ??
  null;

export async function convertM4aToWav(inputUri: string): Promise<string> {
  if (!NativeAudioConverter || !NativeAudioConverter.convertToWav) {
    throw new Error('AudioConverter native module not available');
  }
  // inputUri: file://.../recording.m4a, returns file://.../recording.wav
  const outUri: string = await NativeAudioConverter.convertToWav(inputUri);
  return outUri;
}

export function isAudioConverterAvailable(): boolean {
  return !!NativeAudioConverter?.convertToWav;
}
