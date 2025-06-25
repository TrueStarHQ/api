import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { checkReview } from './services/review-checker/index.js';
import {
  CheckAmazonReviewsRequest,
  CheckAmazonReviewsRequestSchema,
  CheckAmazonReviewsResponse,
  ErrorResponse,
  HealthResponse,
} from './types/api.js';
import { validateEnvironment } from './config/environment.js';

const fastify = Fastify({
  logger: {
    transport: { target: 'pino-pretty' },
  },
});

// Register CORS plugin
await fastify.register(cors, {
  origin: ['http://localhost:3000', 'chrome-extension://*'],
});

// Add request/response logging middleware
fastify.addHook('onRequest', async (request, _reply) => {
  const start = Date.now();

  // Log request
  request.log.info(
    {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.method === 'POST' ? request.body : undefined,
    },
    'Incoming request'
  );

  // Store start time for response logging
  (request as unknown as { startTime: number }).startTime = start;
});

fastify.addHook('onResponse', async (request, reply) => {
  const duration =
    Date.now() - (request as unknown as { startTime: number }).startTime;

  // Log response
  request.log.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
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
    const validationResult = CheckAmazonReviewsRequestSchema.safeParse(
      request.body
    );

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

    // Combine all reviews for analysis
    const combinedReviewText = reviews.join('\n\n---\n\n');

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
    fastify.log.error(error);
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
