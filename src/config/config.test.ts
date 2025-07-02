import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, resetConfigForTests } from './config.js';

describe('Config validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfigForTests();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfig validation', () => {
    it('validates with custom values for optional environment variables', () => {
      process.env.OPENAI_API_KEY = 'fake-api-key';
      process.env.PORT = '99999';
      process.env.HOST = 'fake-host';
      process.env.NODE_ENV = 'test';
      process.env.OPENAI_MODEL = 'fake-model';
      process.env.ALLOWED_ORIGINS =
        'https://fake-domain1.com,https://fake-domain2.com';

      const config = getConfig();

      expect(config).toEqual({
        OPENAI_API_KEY: 'fake-api-key',
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

    it('validates with only required environment variables', () => {
      // Only set the required OPENAI_API_KEY
      process.env = { OPENAI_API_KEY: 'fake-api-key' };

      const config = getConfig();

      expect(config.OPENAI_API_KEY).toBe('fake-api-key');
    });

    it('uses default values for optional fields when not provided', () => {
      // Only set the required OPENAI_API_KEY
      process.env = { OPENAI_API_KEY: 'fake-api-key' };

      const config = getConfig();

      // Should have default values for all optional fields
      expect(config.PORT).toBe(8080);
      expect(config.HOST).toBe('0.0.0.0');
      expect(config.NODE_ENV).toBe('development');
      expect(config.OPENAI_MODEL).toBe('gpt-4o');
      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.ALLOWED_ORIGINS).toEqual([
        'https://amazon.com',
        'https://www.amazon.com',
        'https://www.amazon.ca',
        'https://www.amazon.co.uk',
        'https://www.amazon.de',
        'https://www.amazon.fr',
        'https://www.amazon.it',
        'https://www.amazon.es',
        'https://www.amazon.com.au',
      ]);
    });

    it('throws error when OPENAI_API_KEY is missing', () => {
      process.env = {}; // Clear all environment variables

      expect(() => getConfig()).toThrow();
    });

    it('throws error when OPENAI_API_KEY is empty', () => {
      process.env = { OPENAI_API_KEY: '' };

      expect(() => getConfig()).toThrow('OpenAI API key is required');
    });

    it('throws error when PORT is not a number', () => {
      process.env = {
        OPENAI_API_KEY: 'fake-api-key',
        PORT: 'not-a-number',
      };

      expect(() => getConfig()).toThrow('Expected number, received nan');
    });

    it('throws error when NODE_ENV is invalid', () => {
      process.env = {
        OPENAI_API_KEY: 'fake-api-key',
        NODE_ENV: 'invalid-env',
      };

      expect(() => getConfig()).toThrow('Invalid enum value');
    });
  });

  describe('getConfig', () => {
    it('returns config when environment has valid values', () => {
      process.env.OPENAI_API_KEY = 'fake-api-key';

      const config = getConfig();

      expect(config.OPENAI_API_KEY).toBe('fake-api-key');
    });

    it('throws error when OPENAI_API_KEY is missing in non-test environments', () => {
      // Simulate production environment with missing key
      process.env.NODE_ENV = 'production';
      delete process.env.OPENAI_API_KEY;
      resetConfigForTests();

      expect(() => getConfig()).toThrow('Required');
    });

    it('caches config after first call', () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2); // Same object reference
    });
  });
});
