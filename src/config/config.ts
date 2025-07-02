import { z } from 'zod';

export function getConfig(): Config {
  if (!validatedConfig) {
    validatedConfig = ConfigSchema.parse(process.env);
  }

  return validatedConfig;
}

export type Config = z.infer<typeof ConfigSchema>;

const DEFAULT_AMAZON_DOMAINS = [
  'https://amazon.com',
  'https://www.amazon.com',
  'https://www.amazon.ca',
  'https://www.amazon.co.uk',
  'https://www.amazon.de',
  'https://www.amazon.fr',
  'https://www.amazon.it',
  'https://www.amazon.es',
  'https://www.amazon.com.au',
].join(',');

const ConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  OPENAI_MODEL: z.string().optional().default('gpt-4o'),
  HOST: z.string().optional().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().optional().default(8080),
  LOG_LEVEL: z.string().optional().default('debug'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .default(DEFAULT_AMAZON_DOMAINS)
    .transform((s) => s.split(',')),
});

let validatedConfig: Config | null = null;

// Test utility to reset cached config between test cases
export function resetConfigForTests(): void {
  if (!process.env.VITEST) {
    throw new Error(
      'resetConfigForTests() can only be called in test environment'
    );
  }

  validatedConfig = null;
}
