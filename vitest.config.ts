import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables with override to ensure test values take precedence
config({
  path: join(import.meta.dirname, 'test', '.env.test'),
  override: true,
});

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
