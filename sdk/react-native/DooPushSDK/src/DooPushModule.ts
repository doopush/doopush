import { requireNativeModule } from 'expo-modules-core';

/**
 * Raw native module accessor.
 * DO NOT use directly in app code — use the `DooPush` namespace in `./DooPush`.
 * Exposed for testing and for advanced consumers (e.g. RN bridge wrappers).
 */
export const DooPushModule = requireNativeModule('DooPushReactNativeSDK');
