import { validatePluginConfig } from '../schema';

describe('validatePluginConfig', () => {
  test('accepts minimum valid config', () => {
    const result = validatePluginConfig({
      appId: 'app_123',
      apiKey: 'key_abc',
    });
    expect(result.appId).toBe('app_123');
    expect(result.apiKey).toBe('key_abc');
    expect(result.ios.mode).toBe('production'); // default
    expect(result.android.vendors).toEqual({});
  });

  test('accepts full config with fcm vendor', () => {
    const result = validatePluginConfig({
      appId: 'app_123',
      apiKey: 'key_abc',
      baseURL: 'https://test.doopush.com/api/v1',
      ios: { mode: 'development' },
      android: {
        vendors: {
          fcm: { googleServicesFile: './google-services.json' },
        },
      },
    });
    expect(result.android.vendors.fcm?.googleServicesFile).toBe(
      './google-services.json'
    );
  });

  test('rejects missing appId', () => {
    expect(() => validatePluginConfig({ apiKey: 'k' })).toThrow(
      /appId is required/
    );
  });

  test('rejects missing apiKey', () => {
    expect(() => validatePluginConfig({ appId: 'a' })).toThrow(
      /apiKey is required/
    );
  });

  test('rejects fcm vendor without googleServicesFile', () => {
    expect(() =>
      validatePluginConfig({
        appId: 'a',
        apiKey: 'k',
        android: { vendors: { fcm: {} } },
      })
    ).toThrow(/googleServicesFile is required/);
  });

  test('rejects invalid baseURL', () => {
    expect(() =>
      validatePluginConfig({ appId: 'a', apiKey: 'k', baseURL: 'not-a-url' })
    ).toThrow();
  });
});
