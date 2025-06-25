import OpenAI from 'openai';
import { FastifyBaseLogger } from 'fastify';
import {
  ReviewChecker,
  ReviewCheckerSchema,
  ProductContext,
} from '../../types/generated/index.js';
import { SYSTEM_REVIEW_CHECKER_PROMPT, userReviewPrompt } from './prompts.js';
import { getConfig } from '../../config/environment.js';

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
  productContext?: ProductContext,
  logger?: FastifyBaseLogger
): Promise<ReviewChecker> {
  const systemPrompt = SYSTEM_REVIEW_CHECKER_PROMPT;
  const userPrompt = userReviewPrompt(reviewText, productContext);

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
