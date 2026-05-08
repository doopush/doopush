import { withAndroid } from '../android/withAndroid';
import { ExpoConfig } from '@expo/config-types';

const baseConfig: ExpoConfig = {
  name: 'TestApp',
  slug: 'testapp',
  android: {
    package: 'com.test.app',
  },
};

describe('withAndroid', () => {
  test('registers project + app + dangerous mods when fcm enabled', () => {
    const result: any = withAndroid(structuredClone(baseConfig), {
      appId: 'a', apiKey: 'k',
      ios: { mode: 'production' },
      android: {
        vendors: { fcm: { googleServicesFile: './google-services.json' } },
      },
    });
    expect(result.mods?.android).toBeDefined();
    // The mod compiler accumulates Gradle + file-copy mods.
    // We at least verify the registration shape exists.
    expect(typeof result.mods.android.gradleProperties).toBe('function');
    expect(typeof result.mods.android.projectBuildGradle).toBe('function');
    expect(typeof result.mods.android.appBuildGradle).toBe('function');
    expect(typeof result.mods.android.dangerous).toBe('function');
  });

  test('does NOT register dangerous mod (file copy) when fcm omitted', () => {
    const result: any = withAndroid(structuredClone(baseConfig), {
      appId: 'a', apiKey: 'k',
      ios: { mode: 'production' },
      android: { vendors: {} },
    });
    // projectBuildGradle and appBuildGradle still register (for placeholders + maven repos),
    // but dangerous (file copy) is skipped because no FCM file is provided.
    expect(result.mods?.android?.gradleProperties).toBeDefined();
    expect(result.mods?.android?.projectBuildGradle).toBeDefined();
    expect(result.mods?.android?.dangerous).toBeUndefined();
  });
});
