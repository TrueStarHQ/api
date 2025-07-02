import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfig, resetConfigForTests } from './config.js';

describe('Config', () => {
  beforeEach(() => {
    resetConfigForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetConfigForTests();
  });

  describe('getConfig', () => {
    it('validates with custom values for optional environment variables', () => {
      vi.stubEnv('OPENAI_API_KEY', 'some-api-key');
      vi.stubEnv('PORT', '99999');
      vi.stubEnv('HOST', 'fake-host');
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('OPENAI_MODEL', 'fake-model');
      vi.stubEnv(
        'ALLOWED_ORIGINS',
        'https://fake-domain1.com,https://fake-domain2.com'
      );
      resetConfigForTests();

      const config = getConfig();

      expect(config).toEqual({
        OPENAI_API_KEY: 'some-api-key',
        PORT: 99999,
        HOST: 'fake-host',
        NODE_ENV: 'test',
        OPENAI_MODEL: 'fake-model',
        LOG_LEVEL: 'debug',
        ALLOWED_ORIGINS: [
          'https://fake-domain1.com',
          'https://fake-domain2.com',
        ],
      });
    });

    it('validates with only required environment variables from .env.test', () => {
      const config = getConfig();
      expect(config.OPENAI_API_KEY).toBe('fake-openai-api-key');
      expect(config.NODE_ENV).toBe('test');
    });

    it('throws error when OPENAI_API_KEY is missing', () => {
      vi.stubEnv('OPENAI_API_KEY', '');
      delete process.env.OPENAI_API_KEY;
      resetConfigForTests();
      expect(() => getConfig()).toThrow();
    });

    it('throws error when OPENAI_API_KEY is empty', () => {
      vi.stubEnv('OPENAI_API_KEY', '');
      resetConfigForTests();
      expect(() => getConfig()).toThrow('OpenAI API key is required');
    });

    it('throws error when PORT is not a number', () => {
      vi.stubEnv('PORT', 'not-a-number');
      resetConfigForTests();
      expect(() => getConfig()).toThrow('Expected number, received nan');
    });

    it('throws error when NODE_ENV is invalid', () => {
      vi.stubEnv('NODE_ENV', 'invalid-env');
      resetConfigForTests();
      expect(() => getConfig()).toThrow('Invalid enum value');
    });

    it('returns config when environment has valid values from .env.test', () => {
      const config = getConfig();
      expect(config.OPENAI_API_KEY).toBe('fake-openai-api-key');
    });

    it('throws error when OPENAI_API_KEY is missing in non-test environments', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('OPENAI_API_KEY', '');
      delete process.env.OPENAI_API_KEY;
      resetConfigForTests();

      expect(() => getConfig()).toThrow('Required');
    });

    it('caches config after first call', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2);
    });
  });
});
