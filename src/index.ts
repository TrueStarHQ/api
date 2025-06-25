import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { checkReview } from './services/review-checker/index.js';
import {
  CheckAmazonReviewsRequest,
  CheckAmazonReviewsResponse,
  ErrorResponse,
  HealthResponse,
} from './types/generated/index.js';
import { checkAmazonReviewsBody } from './types/generated/zod.js';
import { validateEnvironment } from './config/environment.js';

// Extend Fastify request type to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime: number;
  }
}

const fastify = Fastify({
  logger: {
    transport: { target: 'pino-pretty' },
  },
});

// Register CORS plugin
await fastify.register(cors, {
  origin: (origin, callback) => {
    // Log the actual origin for debugging
    fastify.log.info({ origin }, 'CORS origin check');

    // Allow Amazon domains (where the extension runs) and no origin
    const allowedOrigins = [
      'https://amazon.com',
      'https://www.amazon.com',
      'https://www.amazon.ca',
      'https://www.amazon.co.uk',
      'https://www.amazon.de',
      'https://www.amazon.fr',
      'https://www.amazon.it',
      'https://www.amazon.es',
      'https://www.amazon.com.au',
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      fastify.log.info({ origin }, 'CORS origin allowed');
      callback(null, true);
    } else {
      fastify.log.warn({ origin }, 'CORS origin rejected');
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: false,
});

// Add request/response logging middleware
fastify.addHook('onRequest', async (request, _reply) => {
  // Store start time for response logging
  request.startTime = Date.now();

  // Log request
  request.log.info(
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

  // Log response
  request.log.info(
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

// Health check endpoint
fastify.get('/health', async (): Promise<HealthResponse> => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Amazon review checking endpoint
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

      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details,
        validationErrors,
        timestamp: new Date().toISOString(),
      });
    }

    const { reviews, productContext } = validationResult.data;

    // Convert ReviewData objects to formatted strings for analysis
    const combinedReviewText = reviews
      .map(
        (review) =>
          `Rating: ${review.rating}/5\nAuthor: ${review.author}\nVerified: ${review.verified ? 'Yes' : 'No'}\nReview: ${review.text}`
      )
      .join('\n\n---\n\n');

    const result = await checkReview(
      combinedReviewText,
      productContext,
      request.log
    );

    return {
      result: result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    fastify.log.error(
      { error, requestBody: request.body },
      'Error processing review analysis request'
    );
    return reply.status(500).send({
      error: 'SERVICE_ERROR',
      service: 'review-analyzer',
      details: 'Internal server error occurred while processing the request',
      timestamp: new Date().toISOString(),
    });
  }
});

// Start server
const start = async () => {
  try {
    // Validate environment variables before starting
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

start();
