import OpenAI from 'openai';
import { FastifyBaseLogger } from 'fastify';
import {
  ReviewAnalysis,
  ReviewAnalysisSchema,
  ProductContext,
} from '../../types/api.js';
import { SYSTEM_REVIEW_ANALYSIS_PROMPT, userReviewPrompt } from './prompts.js';
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

export async function analyzeReview(
  reviewText: string,
  productContext?: ProductContext,
  logger?: FastifyBaseLogger
): Promise<ReviewAnalysis> {
  const systemPrompt = SYSTEM_REVIEW_ANALYSIS_PROMPT;
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
    const analysis = ReviewAnalysisSchema.parse(rawAnalysis);

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
