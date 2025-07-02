import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, resetConfigForTests } from './config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfigForTests();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('validates with custom values for optional environment variables', () => {
      process.env = {
        OPENAI_API_KEY: 'some-api-key',
        PORT: '99999',
        HOST: 'fake-host',
        NODE_ENV: 'test',
        OPENAI_MODEL: 'fake-model',
        ALLOWED_ORIGINS: 'https://fake-domain1.com,https://fake-domain2.com',
      };

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
      process.env = {};
      expect(() => getConfig()).toThrow();
    });

    it('throws error when OPENAI_API_KEY is empty', () => {
      process.env.OPENAI_API_KEY = '';
      expect(() => getConfig()).toThrow('OpenAI API key is required');
    });

    it('throws error when PORT is not a number', () => {
      process.env.PORT = 'not-a-number';
      expect(() => getConfig()).toThrow('Expected number, received nan');
    });

    it('throws error when NODE_ENV is invalid', () => {
      process.env.NODE_ENV = 'invalid-env';
      expect(() => getConfig()).toThrow('Invalid enum value');
    });

    it('returns config when environment has valid values from .env.test', () => {
      const config = getConfig();
      expect(config.OPENAI_API_KEY).toBe('fake-openai-api-key');
    });

    it('throws error when OPENAI_API_KEY is missing in non-test environments', () => {
      process.env.NODE_ENV = 'production';
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
