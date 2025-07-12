import type {
  CheckAmazonProductRequest,
  CheckAmazonProductResponse,
} from '@truestarhq/shared-types';
import { checkAmazonProductBody } from '@truestarhq/shared-types';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { analyzeContentPatterns } from './content-pattern-analyzer/index.js';
import { detectLocalFlags } from './flag-detectors/index.js';
import { calculateTrustScore } from './trust-score-calculator.js';

export async function checkAmazonProductHandler(
  request: FastifyRequest<{ Body: CheckAmazonProductRequest }>,
  reply: FastifyReply
) {
  const validationResult = checkAmazonProductBody.safeParse(request.body);

  if (!validationResult.success) {
    const validationErrors = validationResult.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    const details = validationErrors
      .map((err) => `${err.field}: ${err.message}`)
      .join(', ');

    return reply.code(400).send({
      statusCode: 400,
      error: details,
      timestamp: new Date().toISOString(),
    });
  }

  const data = validationResult.data;

  const [localAnalysis, contentAnalysis] = await Promise.all([
    detectLocalFlags(data.reviews),
    analyzeContentPatterns(data.reviews),
  ]);

  const allRedFlags = [...localAnalysis.redFlags, ...contentAnalysis.redFlags];
  const allGreenFlags = [...localAnalysis.greenFlags];

  const trustScore = calculateTrustScore({
    redFlags: allRedFlags,
    greenFlags: allGreenFlags,
  });

  const response: CheckAmazonProductResponse = {
    summary: {
      trustScore,
    },
    metrics: {
      analyzed: data.reviews.length,
      total: data.reviews.length,
    },
    timestamp: new Date().toISOString(),
  };

  if (allGreenFlags.length > 0) {
    response.greenFlags = allGreenFlags;
  }

  if (allRedFlags.length > 0) {
    response.redFlags = allRedFlags;
  }

  return reply.send(response);
}
