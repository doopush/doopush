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
          hms: z
            .object({
              agconnectServicesFile: z.string().min(1).optional(),
            })
            .optional(),
          honor: z
            .object({
              mcsServicesFile: z.string().min(1).optional(),
              clientId: z.string().optional(),
              clientSecret: z.string().optional(),
              appId: z.string().optional(),
              developerId: z.string().optional(),
            })
            .optional(),
          xiaomi: z
            .object({
              servicesFile: z.string().min(1).optional(),
              appId: z.string().optional(),
              appKey: z.string().optional(),
            })
            .optional(),
          oppo: z
            .object({
              servicesFile: z.string().min(1).optional(),
              appKey: z.string().optional(),
              appSecret: z.string().optional(),
            })
            .optional(),
          vivo: z
            .object({
              servicesFile: z.string().min(1).optional(),
              appId: z.string().optional(),
              apiKey: z.string().optional(),
            })
            .optional(),
          meizu: z
            .object({
              servicesFile: z.string().min(1).optional(),
              appId: z.string().optional(),
              appKey: z.string().optional(),
            })
            .optional(),
        })
        .superRefine((vendors, ctx) => {
          if (vendors.hms && !vendors.hms.agconnectServicesFile) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['hms', 'agconnectServicesFile'],
              message: 'agconnectServicesFile is required when hms vendor is enabled',
            });
          }

          const requireFileOrPair = (
            vendorName: 'honor' | 'xiaomi' | 'oppo' | 'vivo' | 'meizu',
            pair: [string, string],
            fileKey = 'servicesFile'
          ) => {
            const vendor = vendors[vendorName] as Record<string, string | undefined> | undefined;
            if (!vendor) return;
            const hasFile = Boolean(vendor[fileKey]);
            const hasPair = Boolean(vendor[pair[0]]) && Boolean(vendor[pair[1]]);
            if (!hasFile && !hasPair) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [vendorName],
                message: `${vendorName} requires either ${fileKey} or ${pair[0]} + ${pair[1]}`,
              });
            }
          };

          if (vendors.honor) {
            const honor = vendors.honor;
            const hasFile = Boolean(honor.mcsServicesFile);
            const hasAppPair = Boolean(honor.appId) && Boolean(honor.developerId);
            const hasClientPair = Boolean(honor.clientId) && Boolean(honor.clientSecret);
            if (!hasFile && !hasAppPair && !hasClientPair) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['honor'],
                message: 'honor requires either mcsServicesFile or appId + developerId or clientId + clientSecret',
              });
            }
          }
          requireFileOrPair('xiaomi', ['appId', 'appKey']);
          requireFileOrPair('oppo', ['appKey', 'appSecret']);
          requireFileOrPair('vivo', ['appId', 'apiKey']);
          requireFileOrPair('meizu', ['appId', 'appKey']);
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
