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
    it('should validate when all required environment variables are present', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.PORT = '3001';
      process.env.HOST = 'localhost';
      process.env.NODE_ENV = 'development';

      const config = validateEnvironment();

      expect(config).toEqual({
        OPENAI_API_KEY: 'test-api-key',
        PORT: '3001',
        HOST: 'localhost',
        NODE_ENV: 'development',
        OPENAI_MODEL: 'gpt-4o', // default value
      });
    });

    it('should validate with only required environment variables', () => {
      // Clear all environment variables except the ones we set
      process.env = { OPENAI_API_KEY: 'test-api-key' };

      const config = validateEnvironment();

      expect(config).toEqual({
        OPENAI_API_KEY: 'test-api-key',
        OPENAI_MODEL: 'gpt-4o', // default value
      });
    });

    it('should use custom OPENAI_MODEL when provided', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.OPENAI_MODEL = 'gpt-3.5-turbo';

      const config = validateEnvironment();

      expect(config.OPENAI_MODEL).toBe('gpt-3.5-turbo');
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
        OPENAI_API_KEY: 'test-api-key',
        PORT: 'not-a-number',
      };

      expect(() => validateEnvironment()).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnvironment()).toThrow(
        'PORT: Port must be a valid number'
      );
    });

    it('should throw error when NODE_ENV is invalid', () => {
      process.env = {
        OPENAI_API_KEY: 'test-api-key',
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
      process.env.OPENAI_API_KEY = 'test-api-key';

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
