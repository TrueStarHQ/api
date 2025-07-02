import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { FastifyInstance } from 'fastify';

// Mock the handlers to avoid testing their implementation
vi.mock('./handlers/index.js', () => ({
  healthHandler: vi.fn((_req, _reply) => ({ status: 'ok' })),
  checkAmazonReviewsHandler: vi.fn((_req, _reply) => ({ result: 'mocked' })),
}));

describe('App integration tests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = await createApp();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('Route wiring', () => {
    it('should respond to GET /health', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for POST /health', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/health',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should respond to POST /check/amazon/reviews', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/check/amazon/reviews',
      });

      expect(response.statusCode).not.toBe(404);
    });

    it('should return 404 for GET /check/amazon/reviews', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/check/amazon/reviews',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('CORS middleware', () => {
    it('should return CORS headers for preflight requests', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'https://www.amazon.com',
          'access-control-request-method': 'GET',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
