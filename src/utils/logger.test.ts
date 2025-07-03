import { requestContext } from '@fastify/request-context';
import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { log } from './logger.js';

vi.mock('@fastify/request-context', () => ({
  requestContext: {
    get: vi.fn(),
  },
}));

describe('Logger', () => {
  describe('exported instance', () => {
    it('provides all standard logging methods', () => {
      expect(log.info).toBeDefined();
      expect(log.error).toBeDefined();
      expect(log.warn).toBeDefined();
      expect(log.debug).toBeDefined();
    });

    describe('in test environment', () => {
      it('uses no-op functions that can be called safely', () => {
        expect(log.info.name).toBe('no-op');
        expect(log.error.name).toBe('no-op');

        expect(() => log.info('test')).not.toThrow();
        expect(() => log.error('test')).not.toThrow();
        expect(() => log.warn('test')).not.toThrow();
        expect(() => log.debug('test')).not.toThrow();
      });

      it('creates child loggers that are also no-op', () => {
        const child = log.child({ service: 'test' });

        expect(child).not.toBe(log);
        expect(child.info.name).toBe('no-op');
        expect(() => child.info('test')).not.toThrow();
      });
    });

    describe('request context integration', () => {
      it('uses request-scoped logger when available', () => {
        const mockRequestLogger = {
          info: vi.fn(),
        } as unknown as FastifyBaseLogger;

        vi.mocked(requestContext.get).mockReturnValue(mockRequestLogger);

        log.info('test message');

        expect(mockRequestLogger.info).toHaveBeenCalledWith('test message');
        expect(requestContext.get).toHaveBeenCalledWith('logger');
      });

      it('falls back to default logger when no request context', () => {
        vi.mocked(requestContext.get).mockReturnValue(undefined);

        expect(() => log.info('test message')).not.toThrow();
        expect(log.info.name).toBe('no-op');
        expect(requestContext.get).toHaveBeenCalledWith('logger');
      });
    });
  });
});
