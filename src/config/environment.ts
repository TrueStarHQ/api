import { z } from 'zod';

// Environment variable schema
const EnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  PORT: z.coerce.number().int().positive().optional().default(3001),
  HOST: z.string().optional().default('0.0.0.0'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),
  OPENAI_MODEL: z.string().optional().default('gpt-4o'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

let validatedEnv: Environment | null = null;

export function validateEnvironment(): Environment {
  try {
    validatedEnv = EnvironmentSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

export function getConfig(): Environment {
  if (!validatedEnv) {
    throw new Error(
      'Environment not validated. Call validateEnvironment() first.'
    );
  }
  return validatedEnv;
}

// For testing: reset the cached environment
export function resetEnvironment(): void {
  validatedEnv = null;
}
