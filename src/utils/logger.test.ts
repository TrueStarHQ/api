import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createLogger } from './logger.js';
import { resetConfigForTests } from '../config/config.js';

describe('Logger', () => {
  describe('exported instance', () => {
    it('provides all standard logging methods', () => {
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    describe('in test environment', () => {
      it('uses no-op functions that can be called safely', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(logger.info.name).toBe('no-op');
        expect(logger.error.name).toBe('no-op');

        expect(() => logger.info('test')).not.toThrow();
        expect(() => logger.error('test')).not.toThrow();
        expect(() => logger.warn('test')).not.toThrow();
        expect(() => logger.debug('test')).not.toThrow();
      });

      it('creates child loggers that are also no-op', () => {
        const child = logger.child({ service: 'test' });

        expect(child).not.toBe(logger);
        expect(child.info.name).toBe('no-op');
        expect(() => child.info('test')).not.toThrow();
      });
    });
  });

  describe('createLogger()', () => {
    describe('in development environment', () => {
      beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));
      afterEach(() => vi.unstubAllEnvs());

      it('has standard Pino logger interface', () => {
        const devLogger = createLogger();

        expect(devLogger.level).toBeDefined();
        expect(devLogger.child).toBeDefined();
        expect(typeof devLogger.info).toBe('function');
        expect(typeof devLogger.error).toBe('function');
      });

      it('creates independent child loggers with context', () => {
        const devLogger = createLogger();
        const child = devLogger.child({ service: 'test' });

        expect(child).toBeDefined();
        expect(child).not.toBe(devLogger);
        expect(typeof child.info).toBe('function');
      });

      it('defaults to debug log level for maximum visibility', () => {
        const devLogger = createLogger();
        expect(devLogger.level).toBe('debug');
      });

      it('respects custom log level', () => {
        const customLogger = createLogger({ level: 'warn' });
        expect(customLogger.level).toBe('warn');
      });
    });

    describe('in production environment', () => {
      beforeEach(() => vi.stubEnv('NODE_ENV', 'production'));
      afterEach(() => vi.unstubAllEnvs());

      it('has standard Pino logger interface', () => {
        const prodLogger = createLogger();

        expect(prodLogger.level).toBeDefined();
        expect(prodLogger.child).toBeDefined();
        expect(typeof prodLogger.info).toBe('function');
        expect(typeof prodLogger.error).toBe('function');
      });

      it('creates independent child loggers with context', () => {
        const prodLogger = createLogger();
        const child = prodLogger.child({ service: 'test' });

        expect(child).toBeDefined();
        expect(child).not.toBe(prodLogger);
        expect(typeof child.info).toBe('function');
      });

      it('defaults to debug log level', () => {
        const prodLogger = createLogger();
        expect(prodLogger.level).toBe('debug');
      });
    });

    it('respects LOG_LEVEL environment variable over defaults', async () => {
      resetConfigForTests();

      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('LOG_LEVEL', 'warn');

      const customLogger = createLogger();
      expect(customLogger.level).toBe('warn');

      vi.unstubAllEnvs();
      resetConfigForTests();
    });
  });
});
