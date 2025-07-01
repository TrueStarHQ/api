import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { FastifyRequest, FastifyServerOptions } from 'fastify';
import { checkReview } from './services/review-checker/index.js';
import {
  CheckAmazonReviewsRequest,
  CheckAmazonReviewsResponse,
  ErrorResponse,
  HealthResponse,
} from './types/generated/index.js';
import { checkAmazonReviewsBody } from './types/generated/zod.js';
import { validateEnvironment, getConfig } from './config/environment.js';
import { errorHandlingPlugin } from './plugins/error-handling.js';

// Extend Fastify request type to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime: number;
  }
}

function getLoggerConfig(): FastifyServerOptions['logger'] {
  if (process.env.NODE_ENV === 'production') {
    return {
      level: 'info',
      serializers: {
        req: (req: FastifyRequest) => ({
          method: req.method,
          url: req.url,
          headers: {
            'user-agent': req.headers['user-agent'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
          },
        }),
        res: (res: { statusCode: number }) => ({
          statusCode: res.statusCode,
        }),
      },
    };
  }

  return {
    transport: { target: 'pino-pretty' },
  };
}

const fastify = Fastify({
  logger: getLoggerConfig(),
});

await fastify.register(errorHandlingPlugin);

await fastify.register(cors, {
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
});

fastify.addHook('onRequest', async (request, _reply) => {
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
});

fastify.addHook('onResponse', async (request, reply) => {
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
});

fastify.get('/health', async (): Promise<HealthResponse> => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.post<{
  Body: CheckAmazonReviewsRequest;
  Reply: CheckAmazonReviewsResponse | ErrorResponse;
}>('/check/amazon/reviews', async (request, reply) => {
  try {
    // Validate request body using Zod schema
    const validationResult = checkAmazonReviewsBody.safeParse(request.body);

    if (!validationResult.success) {
      const validationErrors = validationResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      const details = validationErrors
        .map((err) => `${err.field}: ${err.message}`)
        .join(', ');

      return reply.sendError({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        details,
        timestamp: new Date().toISOString(),
      });
    }

    // Convert ReviewData objects to formatted strings for analysis
    const combinedReviewText = validationResult.data.reviews
      .map(
        (review) =>
          `Rating: ${review.rating}/5\nAuthor: ${review.author}\nVerified: ${review.verified ? 'Yes' : 'No'}\nReview: ${review.text}`
      )
      .join('\n\n---\n\n');

    const result = await checkReview(combinedReviewText, request.log);

    return {
      result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    fastify.log.error(
      { error, requestBody: request.body },
      'Error processing review analysis request'
    );

    return reply.sendError({
      statusCode: 500,
      error: 'SERVICE_ERROR',
      details: 'Internal server error occurred while processing the request',
      timestamp: new Date().toISOString(),
    });
  }
});

const startServer = async () => {
  try {
    const config = validateEnvironment();
    fastify.log.info('Environment validation passed');
    fastify.log.info(`Configuration: PORT=${config.PORT}, HOST=${config.HOST}`);

    const port = config.PORT;
    const host = config.HOST;

    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();
