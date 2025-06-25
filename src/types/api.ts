import { z } from 'zod';

export const ProductContextSchema = z.object({
  title: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  price: z.number().optional(),
  rating: z.number().min(1).max(5).optional(),
});

// Amazon-specific request schema
export const ScanAmazonProductRequestSchema = z.object({
  asin: z.string().min(10).max(10, 'ASIN must be exactly 10 characters'),
});

// For batch processing multiple products
export const ScanAmazonProductsRequestSchema = z.object({
  asins: z
    .array(z.string().min(10).max(10, 'ASIN must be exactly 10 characters'))
    .min(1)
    .max(10),
});

// Future scan schemas
// export const ScanIndividualReviewRequestSchema = z.object({
//   reviewText: z.string().min(1, 'Review text cannot be empty'),
//   context: z.string().optional(),
// });
// export const ScanSellerRequestSchema = z.object({
//   sellerId: z.string(),
//   platform: z.enum(['amazon', 'walmart', 'ebay']),
// });

// Response schemas
export const ReviewAnalysisSchema = z.object({
  isFake: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  flags: z.array(
    z.enum([
      'generic_language',
      'excessive_positivity',
      'incentivized_review',
      'competitor_mention',
      'unnatural_language',
      'repetitive_phrases',
      'suspicious_timing',
      'verified_purchase_missing',
    ])
  ),
  summary: z.string(),
});

export const ScanResponseSchema = z.object({
  analysis: ReviewAnalysisSchema,
  timestamp: z.string(),
});

// Error response types
export interface BaseErrorResponse {
  error: string;
  details?: string;
  timestamp: string;
}

export interface ValidationErrorResponse extends BaseErrorResponse {
  error: 'VALIDATION_ERROR';
  details: string;
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface ServiceErrorResponse extends BaseErrorResponse {
  error: 'SERVICE_ERROR';
  service: string;
}

export interface ConfigurationErrorResponse extends BaseErrorResponse {
  error: 'CONFIGURATION_ERROR';
}

export type ErrorResponse =
  | BaseErrorResponse
  | ValidationErrorResponse
  | ServiceErrorResponse
  | ConfigurationErrorResponse;

// Type exports
export type ProductContext = z.infer<typeof ProductContextSchema>;
export type ScanAmazonProductRequest = z.infer<
  typeof ScanAmazonProductRequestSchema
>;
export type ScanAmazonProductsRequest = z.infer<
  typeof ScanAmazonProductsRequestSchema
>;
export type ReviewAnalysis = z.infer<typeof ReviewAnalysisSchema>;
export type ScanResponse = z.infer<typeof ScanResponseSchema>;

// Response types for routes
export type HealthResponse = {
  status: string;
  timestamp: string;
};
