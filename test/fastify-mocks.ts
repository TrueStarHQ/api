import type { FastifyRequest, FastifyReply } from 'fastify';
import { vi } from 'vitest';

/**
 * Creates a minimal FastifyRequest mock for unit testing handlers.
 * Only includes the properties commonly used in tests.
 */
export function createMockRequest<T = unknown>(
  overrides: {
    body?: T;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    log?: Record<string, unknown>;
  } = {}
): FastifyRequest<{ Body: T }> {
  return {
    body: overrides.body,
    query: overrides.query || {},
    params: overrides.params || {},
    headers: overrides.headers || {},
    log: overrides.log || {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as FastifyRequest<{ Body: T }>;
}

/**
 * Creates a minimal FastifyReply mock for unit testing handlers.
 * Only includes the properties commonly used in tests.
 */
export function createMockReply(): FastifyReply {
  const reply = {
    code: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    sendError: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    headers: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    statusCode: 200,
  };

  // Properly type the mock
  return reply as unknown as FastifyReply;
}
