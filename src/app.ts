import type { FastifyCorsOptions } from '@fastify/cors';
import cors from '@fastify/cors';
import { fastifyRequestContext } from '@fastify/request-context';
import fastifyStatic from '@fastify/static';
import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import Fastify from 'fastify';
import { join } from 'path';

import { getConfig } from './config/config.js';
import { checkAmazonReviewsHandler, healthHandler } from './handlers/index.js';
import { errorHandler } from './plugins/error-handler.js';
import { getPinoOptions } from './utils/logger.js';

declare module '@fastify/request-context' {
  interface RequestContextData {
    logger: FastifyBaseLogger;
  }
}

export async function createApp() {
  const config = getConfig();
  const fastify = Fastify({
    logger: config.NODE_ENV === 'test' ? false : getPinoOptions(),
  });

  await fastify.register(fastifyRequestContext);
  await fastify.register(errorHandler);
  await fastify.register(cors, getCorsOptions(fastify));

  await fastify.register(fastifyStatic, {
    root: join(process.cwd(), 'public'),
    prefix: '/',
  });

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
  fastify.addHook('onRequest', (request, _reply, done) => {
    request.requestContext.set('logger', request.log);

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

    done();
  });

  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      request.log.debug(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration: `${reply.elapsedTime}ms`,
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
