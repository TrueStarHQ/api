import OpenAI from 'openai';
import { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import {
  ReviewChecker,
} from '../../types/generated/index.js';
import { SYSTEM_REVIEW_CHECKER_PROMPT, userReviewPrompt } from './prompts.js';
import { getConfig } from '../../config/environment.js';

// Zod schema for validating OpenAI response
const ReviewCheckerSchema = z.object({
  isFake: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  flags: z.array(z.enum([
    'generic_language',
    'excessive_positivity',
    'incentivized_review',
    'competitor_mention',
    'unnatural_language',
    'repetitive_phrases',
    'suspicious_timing',
    'verified_purchase_missing'
  ])),
  summary: z.string()
});

let openai: OpenAI;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const config = getConfig();
    openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }
  return openai;
}

export async function checkReview(
  reviewText: string,
  logger?: FastifyBaseLogger
): Promise<ReviewChecker> {
  const systemPrompt = SYSTEM_REVIEW_CHECKER_PROMPT;
  const userPrompt = userReviewPrompt(reviewText);

  try {
    const config = getConfig();
    const openaiClient = getOpenAIClient();

    const completion = await openaiClient.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const rawAnalysis = JSON.parse(response);

    // Log the raw response for debugging
    logger?.debug({ rawAnalysis }, 'Raw OpenAI response');

    const analysis = ReviewCheckerSchema.parse(rawAnalysis);
    return analysis;
  } catch (error) {
    logger?.error({ err: error }, 'Error analyzing review');

    // Return a fallback analysis if OpenAI fails
    return {
      isFake: false,
      confidence: 0,
      reasons: ['Analysis failed - unable to determine authenticity'],
      flags: [],
      summary: 'Could not analyze review due to service error',
    };
  }
}
