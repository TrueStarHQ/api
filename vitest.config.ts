import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(import.meta.dirname, 'test', '.env.test') });

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
