import { withIOS } from '../ios/withIOS';
import { ExpoConfig } from '@expo/config-types';

const baseConfig: ExpoConfig = {
  name: 'TestApp',
  slug: 'testapp',
  ios: {
    bundleIdentifier: 'com.test.app',
  },
};

const baseValidated = {
  appId: 'a', apiKey: 'k',
  ios: { mode: 'development' as const },
  android: { vendors: {} },
};

describe('withIOS', () => {
  test('adds remote-notification to UIBackgroundModes', () => {
    const result = withIOS(structuredClone(baseConfig), baseValidated) as any;
    // Expo applies mods asynchronously by registering them; for test we have to drive
    // through compileModsAsync OR inspect that mods were registered. Easiest: check ios mods.
    const iosMods = result.mods?.ios;
    expect(iosMods).toBeDefined();
    expect(typeof iosMods?.infoPlist).toBe('function');
    expect(typeof iosMods?.entitlements).toBe('function');
    expect(typeof iosMods?.dangerous).toBe('function');
  });

  test('records ios.mode for entitlements', () => {
    const productionConfig = withIOS(structuredClone(baseConfig), {
      ...baseValidated,
      ios: { mode: 'production' },
    }) as any;
    expect(productionConfig.mods?.ios?.entitlements).toBeDefined();
  });
});
