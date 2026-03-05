import { z } from 'zod';

/**
 * Schema Zod para validação de variáveis de ambiente na inicialização.
 * O app deve crashar imediatamente se faltar variável obrigatória.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .url({ message: 'DATABASE_URL deve ser uma URL PostgreSQL válida' }),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // Password Hashing
  PEPPER_SECRET: z
    .string()
    .min(32, 'PEPPER_SECRET deve ter pelo menos 32 caracteres'),

  // Application
  PORT: z.coerce.number().int().positive().default(3009),
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'staging'])
    .default('development'),

  // CORS
  CORS_ORIGINS: z.string().optional(),

  // Swagger
  ENABLE_SWAGGER_DOCS: z.string().optional(),

  // Feature Flags
  FF_BATCH_IMPORT: z.enum(['true', 'false']).optional().default('true'),
  FF_GEOFENCE: z.enum(['true', 'false']).optional().default('true'),
  FF_DISPOSAL: z.enum(['true', 'false']).optional().default('true'),
  FF_ALERTS: z.enum(['true', 'false']).optional().default('true'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `\nValidação de variáveis de ambiente falhou:\n${errors}\n\nVerifique seu arquivo .env ou variáveis de ambiente do sistema.`,
    );
  }
  return result.data;
}
