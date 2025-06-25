import Fastify from 'fastify';
import cors from '@fastify/cors';
import { analyzeReview } from './services/review-analyzer/index.js';
import { amazonReviewFetcher } from './services/amazon/review-fetcher.js';
import {
  ScanAmazonProductRequest,
  ScanAmazonProductRequestSchema,
  ScanAmazonProductsRequest,
  ScanAmazonProductsRequestSchema,
  ScanResponse,
  ErrorResponse,
  HealthResponse,
} from './types/api.js';
import { validateEnvironment } from './config/environment.js';

const fastify = Fastify({
  logger: true,
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

// Amazon product scanning endpoint
fastify.post<{
  Body: ScanAmazonProductRequest;
  Reply: ScanResponse | ErrorResponse;
}>('/scan/amazon/product', async (request, reply) => {
  try {
    // Validate request body using Zod schema
    const validationResult = ScanAmazonProductRequestSchema.safeParse(
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

    const { asin } = validationResult.data;

    // Fetch product and reviews from Amazon
    const productData = await amazonReviewFetcher.fetchProductReviews(asin);
    request.log.info(
      { asin, reviewCount: productData.reviews.length },
      'Fetched Amazon product and reviews'
    );

    // Analyze all reviews as a batch
    const reviewTexts = productData.reviews.map(
      (r) =>
        `Rating: ${r.rating} stars\nTitle: ${r.title}\nReview: ${r.text}\nVerified: ${r.verified}`
    );
    const combinedReviewText = reviewTexts.join('\n\n---\n\n');

    const result = await analyzeReview(
      combinedReviewText,
      productData.product,
      request.log
    );

    return {
      analysis: result,
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

// Batch Amazon products scanning endpoint
fastify.post<{
  Body: ScanAmazonProductsRequest;
  Reply: { results: ScanResponse[] } | ErrorResponse;
}>('/scan/amazon/products', async (request, reply) => {
  try {
    // Validate request body using Zod schema
    const validationResult = ScanAmazonProductsRequestSchema.safeParse(
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

    const { asins } = validationResult.data;

    // Process all ASINs in parallel
    const results = await Promise.all(
      asins.map(async (asin) => {
        try {
          const productData =
            await amazonReviewFetcher.fetchProductReviews(asin);
          request.log.info(
            { asin, reviewCount: productData.reviews.length },
            'Fetched Amazon product and reviews'
          );

          // Analyze all reviews as a batch
          const reviewTexts = productData.reviews.map(
            (r) =>
              `Rating: ${r.rating} stars\nTitle: ${r.title}\nReview: ${r.text}\nVerified: ${r.verified}`
          );
          const combinedReviewText = reviewTexts.join('\n\n---\n\n');

          const result = await analyzeReview(
            combinedReviewText,
            productData.product,
            request.log
          );

          return {
            analysis: result,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          request.log.error({ asin, error }, 'Failed to process ASIN');
          throw error;
        }
      })
    );

    return { results };
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

    const port = config.PORT ? parseInt(config.PORT) : 3001;
    const host = config.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
