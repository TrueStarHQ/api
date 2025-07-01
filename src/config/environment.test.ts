import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateEnvironment,
  getConfig,
  resetEnvironment,
} from './environment.js';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment and cached config
    resetEnvironment();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateEnvironment', () => {
    it('should validate with custom values for optional environment variables', () => {
      process.env.OPENAI_API_KEY = 'fake-api-key';
      process.env.PORT = '99999';
      process.env.HOST = 'fake-host';
      process.env.NODE_ENV = 'test';
      process.env.OPENAI_MODEL = 'fake-model';
      process.env.ALLOWED_ORIGINS =
        'https://fake-domain1.com,https://fake-domain2.com';

      const config = validateEnvironment();

      expect(config).toEqual({
        OPENAI_API_KEY: 'fake-api-key',
        PORT: 99999,
        HOST: 'fake-host',
        NODE_ENV: 'test',
        OPENAI_MODEL: 'fake-model',
        ALLOWED_ORIGINS: [
          'https://fake-domain1.com',
          'https://fake-domain2.com',
        ],
      });
    });

    it('should validate with only required environment variables', () => {
      // Only set the required OPENAI_API_KEY
      process.env = { OPENAI_API_KEY: 'fake-api-key' };

      const config = validateEnvironment();

      // Should succeed and have the required key
      expect(config.OPENAI_API_KEY).toBe('fake-api-key');

      // Should have default values for all optional fields
      expect(config.PORT).toBeDefined();
      expect(config.HOST).toBeDefined();
      expect(config.NODE_ENV).toBeDefined();
      expect(config.OPENAI_MODEL).toBeDefined();
      expect(config.ALLOWED_ORIGINS).toBeDefined();
      expect(Array.isArray(config.ALLOWED_ORIGINS)).toBe(true);
    });

    it('should throw error when OPENAI_API_KEY is missing', () => {
      process.env = {}; // Clear all environment variables

      expect(() => validateEnvironment()).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnvironment()).toThrow('OPENAI_API_KEY: Required');
    });

    it('should throw error when OPENAI_API_KEY is empty', () => {
      process.env = { OPENAI_API_KEY: '' };

      expect(() => validateEnvironment()).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnvironment()).toThrow(
        'OPENAI_API_KEY: OpenAI API key is required'
      );
    });

    it('should throw error when PORT is not a number', () => {
      process.env = {
        OPENAI_API_KEY: 'fake-api-key',
        PORT: 'not-a-number',
      };

      expect(() => validateEnvironment()).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnvironment()).toThrow(
        'Expected number, received nan'
      );
    });

    it('should throw error when NODE_ENV is invalid', () => {
      process.env = {
        OPENAI_API_KEY: 'fake-api-key',
        NODE_ENV: 'invalid-env',
      };

      expect(() => validateEnvironment()).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnvironment()).toThrow('NODE_ENV');
    });
  });

  describe('getConfig', () => {
    it('should return config when environment is validated', () => {
      process.env.OPENAI_API_KEY = 'fake-api-key';

      const validatedConfig = validateEnvironment();
      const retrievedConfig = getConfig();

      expect(retrievedConfig).toBe(validatedConfig);
    });

    it('should throw error when environment is not validated', () => {
      expect(() => getConfig()).toThrow(
        'Environment not validated. Call validateEnvironment() first.'
      );
    });
  });
});
