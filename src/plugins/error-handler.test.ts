import createError from '@fastify/error';
import type { FastifyError, FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetConfigForTests } from '../config/config.js';
import type { ErrorResponse } from '../types/generated/index.js';
import { errorHandler } from './error-handler.js';

describe('errorHandler plugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify({ logger: false });
    await errorHandler(fastify);
  });

  describe('sendError decorator', () => {
    it('decorates reply with sendError method', async () => {
      let hasSendErrorMethod = false;

      fastify.get('/test', (_req, reply) => {
        hasSendErrorMethod = typeof reply.sendError === 'function';
        reply.send({ checked: true });
      });

      await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(hasSendErrorMethod).toBe(true);
    });

    it('sends error response with correct status code', async () => {
      const errorResponse: ErrorResponse = {
        statusCode: 400,
        error: 'FAKE_ERROR_CODE',
        details: 'Something bad happened',
        timestamp: new Date().toISOString(),
      };

      fastify.get('/test-error', (_req, reply) => {
        reply.sendError(errorResponse);
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-error',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(errorResponse);
    });
  });

  describe('error handler', () => {
    it('handles validation errors with VALIDATION_ERROR code', async () => {
      const schema = {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      };

      fastify.post('/validate', { schema }, (_req, reply) => {
        reply.send({ ok: true });
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/validate',
        payload: {},
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<ErrorResponse>();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.details).toBeDefined();
      expect(body.details).toContain("must have required property 'name'");
      expect(body.timestamp).toBeDefined();
    });

    it('preserves custom error codes from thrown errors', async () => {
      const FakeError = createError(
        'FAKE_ERROR_CODE',
        'Custom error message',
        418
      );

      fastify.get('/custom-error', () => {
        throw new FakeError();
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/custom-error',
      });

      expect(response.statusCode).toBe(418);
      const body = response.json<ErrorResponse>();
      expect(body.error).toBe('FAKE_ERROR_CODE');
      expect(body.details).toBe('An error occurred processing your request');
    });

    it('defaults to INTERNAL_SERVER_ERROR when no error code provided', async () => {
      fastify.get('/generic-error', () => {
        throw new Error('Something went wrong');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/generic-error',
      });

      expect(response.statusCode).toBe(500);
      const body = response.json<ErrorResponse>();
      expect(body.error).toBe('INTERNAL_SERVER_ERROR');
      expect(body.details).toBe('An error occurred processing your request');
    });

    it('uses error statusCode with INTERNAL_SERVER_ERROR as fallback code', async () => {
      // Create error without explicit code to test fallback behavior
      const error = new Error('Not found') as FastifyError;
      error.statusCode = 404;

      fastify.get('/status-only-error', () => {
        throw error;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/status-only-error',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json<ErrorResponse>();
      expect(body.error).toBe('INTERNAL_SERVER_ERROR');
      expect(body.details).toBe('An error occurred processing your request');
    });

    it('formats validation error details with field path and message', async () => {
      const schema = {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
      };

      fastify.post('/validate-format', { schema }, (_req, reply) => {
        reply.send({ ok: true });
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/validate-format',
        payload: { email: 'not-an-email' },
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<ErrorResponse>();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.details).toBeDefined();
      expect(body.details).toContain('email');
      expect(body.details).toContain('must match format');
    });
  });

  describe('development error handling', () => {
    beforeEach(async () => {
      vi.stubEnv('NODE_ENV', 'development');
      resetConfigForTests();

      fastify = Fastify({ logger: false });
      await errorHandler(fastify);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      resetConfigForTests();
    });

    it('shows debug information in development for generic errors', async () => {
      fastify.get('/dev-error', () => {
        throw new Error('Database connection failed with password xyz123');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/dev-error',
      });

      const body = response.json<ErrorResponse>();
      expect(body.details).toBe(
        'An error occurred processing your request (DEBUG: Database connection failed with password xyz123)'
      );
    });

    it('shows debug information for known error codes in development', async () => {
      const TimeoutError = createError(
        'ETIMEDOUT',
        'Connection timeout after 30000ms',
        504
      );

      fastify.get('/timeout-error', () => {
        throw new TimeoutError();
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/timeout-error',
      });

      const body = response.json<ErrorResponse>();
      expect(body.details).toBe(
        'Request timeout (DEBUG: Connection timeout after 30000ms)'
      );
    });
  });

  describe('production error handling', () => {
    beforeEach(async () => {
      vi.stubEnv('NODE_ENV', 'production');
      resetConfigForTests();

      fastify = Fastify({ logger: false });
      await errorHandler(fastify);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      resetConfigForTests();
    });

    it('hides error details in production for generic errors', async () => {
      fastify.get('/prod-error', () => {
        throw new Error('Database connection failed with password xyz123');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/prod-error',
      });

      const body = response.json<ErrorResponse>();
      expect(body.details).toBe('An error occurred processing your request');
    });

    it('shows safe messages for known error codes in production', async () => {
      const TimeoutError = createError(
        'ETIMEDOUT',
        'Connection timeout after 30000ms',
        504
      );

      fastify.get('/timeout-error', () => {
        throw new TimeoutError();
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/timeout-error',
      });

      const body = response.json<ErrorResponse>();
      expect(body.details).toBe('Request timeout');
      expect(body.details).not.toContain('30000ms');
    });

    it('still shows validation errors in production', async () => {
      const schema = {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
      };

      fastify.post('/validate-prod', { schema }, (_req, reply) => {
        reply.send({ ok: true });
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/validate-prod',
        payload: { email: 'not-an-email' },
        headers: {
          'content-type': 'application/json',
        },
      });

      const body = response.json<ErrorResponse>();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.details).toContain('email');
      expect(body.details).toContain('must match format');
    });
  });
});
