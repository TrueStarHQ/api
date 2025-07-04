import type { CheckAmazonReviewsRequest } from '@truestarhq/shared-types';
import { checkAmazonReviewsBody } from '@truestarhq/shared-types';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { checkReview } from '../services/review-checker/review-checker.js';

export async function checkAmazonReviewsHandler(
  request: FastifyRequest<{ Body: CheckAmazonReviewsRequest }>,
  reply: FastifyReply
) {
  try {
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

    const combinedReviewText = validationResult.data.reviews
      .map(
        (review) =>
          `Rating: ${review.rating}/5\nAuthor: ${review.author}\nVerified: ${review.verified ? 'Yes' : 'No'}\nReview: ${review.text}`
      )
      .join('\n\n---\n\n');

    const result = await checkReview(combinedReviewText);

    return {
      result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    request.log.error(
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
}
