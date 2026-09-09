import { registerRootComponent } from 'expo';

// Polyfill Node Buffer required by whisper.rn → safe-buffer on React Native/Hermes.
import { Buffer } from 'buffer';
(globalThis as unknown as Record<string, unknown>).Buffer ??= Buffer;
(globalThis as unknown as Record<string, unknown>).global ??= globalThis;

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
