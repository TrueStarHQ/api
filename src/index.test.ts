import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { analyzeReview } from './services/review-analysis/index.js';
import { amazonReviewFetcher } from './services/amazon/review-fetcher.js';
import {
  ScanAmazonProductRequest,
  ScanAmazonProductRequestSchema,
  ScanResponse,
  ErrorResponse,
  ValidationErrorResponse,
  ServiceErrorResponse,
  HealthResponse,
} from './types/api.js';

// Mock the review analysis service
vi.mock('./services/review-analysis/index.js', () => ({
  analyzeReview: vi.fn(),
}));

// Mock the Amazon review fetcher
vi.mock('./services/amazon/review-fetcher.js', () => ({
  amazonReviewFetcher: {
    fetchProductReviews: vi.fn(),
  },
}));

const mockAnalyzeReview = vi.mocked(analyzeReview);
const mockAmazonReviewFetcher = vi.mocked(
  amazonReviewFetcher.fetchProductReviews
);

describe('API Endpoints Integration Tests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({
      logger: false, // Disable logging in tests
    });

    // Register CORS plugin
    await fastify.register(cors, {
      origin: ['http://localhost:3000', 'chrome-extension://*'],
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
          service: 'review-analysis',
          details:
            'Internal server error occurred while processing the request',
          timestamp: new Date().toISOString(),
        });
      }
    });

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const data = JSON.parse(response.payload) as HealthResponse;
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');

      // Verify timestamp is a valid ISO string
      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
    });
  });

  describe('POST /scan/amazon/product', () => {
    it('should analyze product reviews successfully', async () => {
      const mockAnalysis = {
        isFake: true,
        confidence: 0.85,
        reasons: ['Multiple fake reviews detected'],
        flags: ['generic_language' as const, 'suspicious_timing' as const],
        summary: 'Product has suspicious review patterns',
      };

      mockAnalyzeReview.mockResolvedValue(mockAnalysis);

      // Mock product and reviews from Amazon fetcher
      const mockProductData = {
        product: {
          title: 'Test Product',
          brand: 'Test Brand',
          category: 'Electronics',
          price: 29.99,
          rating: 4.5,
        },
        reviews: [
          {
            reviewId: '1',
            rating: 5,
            title: 'Amazing!',
            text: 'Best product ever!',
            author: 'User1',
            date: '2024-01-01',
            verified: false,
            helpfulVotes: 0,
          },
          {
            reviewId: '2',
            rating: 5,
            title: 'Perfect!',
            text: 'Absolutely perfect in every way!',
            author: 'User2',
            date: '2024-01-01',
            verified: false,
            helpfulVotes: 0,
          },
        ],
      };
      mockAmazonReviewFetcher.mockResolvedValue(mockProductData);

      const requestBody: ScanAmazonProductRequest = {
        asin: 'B08N5WRWNW',
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/scan/amazon/product',
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);

      const data = JSON.parse(response.payload) as ScanResponse;
      expect(data.analysis).toEqual(mockAnalysis);
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');

      // Verify the services were called with correct parameters
      expect(mockAmazonReviewFetcher).toHaveBeenCalledWith(requestBody.asin);
      expect(mockAnalyzeReview).toHaveBeenCalledWith(
        expect.stringContaining('Rating: 5 stars'),
        mockProductData.product,
        expect.any(Object) // Fastify logger
      );
    });

    it('should return 400 when ASIN is missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/scan/amazon/product',
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload) as ValidationErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details).toContain('asin');
      expect(data.validationErrors).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(mockAnalyzeReview).not.toHaveBeenCalled();
    });

    it('should return 400 when ASIN is too short', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/scan/amazon/product',
        payload: {
          asin: 'SHORT',
        },
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload) as ValidationErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details).toContain(
        'String must contain at least 10 character(s)'
      );
      expect(data.validationErrors).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(mockAnalyzeReview).not.toHaveBeenCalled();
    });

    it('should return 400 when ASIN is too long', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/scan/amazon/product',
        payload: {
          asin: 'B08N5WRWNWTOOLONG', // Invalid - should be exactly 10 characters
        },
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload) as ValidationErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details).toContain('ASIN must be exactly 10 characters');
      expect(data.validationErrors).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(mockAnalyzeReview).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockAnalyzeReview.mockRejectedValue(new Error('Service unavailable'));

      const mockProductData = {
        product: {
          title: 'Test',
          brand: 'Test',
          category: 'Test',
          price: 10,
          rating: 4,
        },
        reviews: [
          {
            reviewId: '1',
            rating: 5,
            title: 'Test',
            text: 'Test',
            author: 'Test',
            date: '2024-01-01',
            verified: true,
            helpfulVotes: 0,
          },
        ],
      };
      mockAmazonReviewFetcher.mockResolvedValue(mockProductData);

      const requestBody: ScanAmazonProductRequest = {
        asin: 'B08N5WRWNW',
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/scan/amazon/product',
        payload: requestBody,
      });

      expect(response.statusCode).toBe(500);

      const data = JSON.parse(response.payload) as ServiceErrorResponse;
      expect(data.error).toBe('SERVICE_ERROR');
      expect(data.service).toBe('review-analysis');
      expect(data.timestamp).toBeDefined();

      expect(mockAnalyzeReview).toHaveBeenCalledWith(
        expect.any(String), // combined review text
        expect.any(Object), // productContext
        expect.any(Object) // logger
      );
    });

    it('should handle review fetcher errors gracefully', async () => {
      mockAmazonReviewFetcher.mockRejectedValue(
        new Error('Failed to fetch reviews')
      );

      const requestBody: ScanAmazonProductRequest = {
        asin: 'B08N5WRWNW',
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/scan/amazon/product',
        payload: requestBody,
      });

      expect(response.statusCode).toBe(500);

      const data = JSON.parse(response.payload) as ServiceErrorResponse;
      expect(data.error).toBe('SERVICE_ERROR');
      expect(data.service).toBe('review-analysis');
      expect(data.timestamp).toBeDefined();

      expect(mockAmazonReviewFetcher).toHaveBeenCalledWith(requestBody.asin);
      expect(mockAnalyzeReview).not.toHaveBeenCalled();
    });
  });

  describe('CORS', () => {
    it('should allow requests from localhost:3000', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'GET',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
    });

    it('should handle OPTIONS requests from chrome extensions', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/scan/amazon/product',
        headers: {
          origin: 'chrome-extension://abcdefghijklmnop',
          'access-control-request-method': 'POST',
        },
      });

      // Main goal: ensure OPTIONS requests are handled properly (not rejected)
      expect([200, 204]).toContain(response.statusCode);
    });
  });
});
