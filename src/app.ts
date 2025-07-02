import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { FastifyCorsOptions } from '@fastify/cors';
import { errorHandlingPlugin } from './plugins/error-handling.js';
import { logger } from './utils/logger.js';
import { getConfig } from './config/config.js';
import { healthHandler, checkAmazonReviewsHandler } from './handlers/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    startTime: number;
  }
}

export async function createApp() {
  const config = getConfig();
  const fastify = Fastify({
    logger: config.NODE_ENV === 'test' ? false : logger,
  });

  await errorHandlingPlugin(fastify);
  await fastify.register(cors, getCorsOptions(fastify));
  await setupRequestLogging(fastify);
  registerRoutes(fastify);

  await fastify.ready();
  return fastify;
}

function getCorsOptions(fastify: FastifyInstance): FastifyCorsOptions {
  return {
    origin: (origin, callback) => {
      const config = getConfig();
      fastify.log.info({ origin }, 'CORS origin check');

      if (!origin || config.ALLOWED_ORIGINS.includes(origin)) {
        fastify.log.info({ origin }, 'CORS origin allowed');
        callback(null, true);
      } else {
        fastify.log.warn({ origin }, 'CORS origin rejected');
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: false,
  };
}

async function setupRequestLogging(fastify: FastifyInstance) {
  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.startTime = Date.now();

      request.log.debug(
        {
          method: request.method,
          url: request.url,
          origin: request.headers.origin,
          headers: request.headers,
          body: request.method === 'POST' ? request.body : undefined,
        },
        'Incoming request'
      );
    }
  );

  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const duration = Date.now() - request.startTime;

      request.log.debug(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration: `${duration}ms`,
          responseHeaders: reply.getHeaders(),
        },
        'Request completed'
      );
    }
  );
}

function registerRoutes(fastify: FastifyInstance) {
  fastify.get('/health', healthHandler);
  fastify.post('/check/amazon/reviews', checkAmazonReviewsHandler);
}
