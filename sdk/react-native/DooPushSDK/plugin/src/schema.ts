import { z } from 'zod';

/** Plugin input schema. Validated at prebuild time. */
export const PluginConfigSchema = z.object({
  appId: z
    .string({ required_error: 'appId is required', invalid_type_error: 'appId is required' })
    .min(1, 'appId is required'),
  apiKey: z
    .string({ required_error: 'apiKey is required', invalid_type_error: 'apiKey is required' })
    .min(1, 'apiKey is required'),
  baseURL: z.string().url().optional(),
  ios: z
    .object({
      mode: z.enum(['development', 'production']).default('production'),
    })
    .default({}),
  android: z
    .object({
      vendors: z
        .object({
          fcm: z
            .object({
              googleServicesFile: z
                .string({
                  required_error:
                    'googleServicesFile is required when fcm vendor is enabled',
                  invalid_type_error:
                    'googleServicesFile is required when fcm vendor is enabled',
                })
                .min(1, 'googleServicesFile is required when fcm vendor is enabled'),
            })
            .optional(),
          // v0.5.0 will add hms / honor / xiaomi / oppo / vivo / meizu here.
        })
        .default({}),
    })
    .default({}),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/**
 * Parse and validate plugin config; throws a friendly error on invalid input.
 */
export function validatePluginConfig(input: unknown): PluginConfig {
  const result = PluginConfigSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[doopush-react-native-sdk] config plugin received invalid input:\n${issues}`
    );
  }
  return result.data;
}
