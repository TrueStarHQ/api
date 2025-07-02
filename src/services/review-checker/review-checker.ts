import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getConfig } from '../../config/config.js';
import { ReviewChecker, ReviewFlag } from '../../types/generated/index.js';
import { logger } from '../../utils/logger.js';
import { SYSTEM_REVIEW_CHECKER_PROMPT, userReviewPrompt } from './prompts.js';

export async function checkReview(reviewText: string): Promise<ReviewChecker> {
  try {
    const responseContent = await callOpenAI(reviewText);
    return parseAnalysisResponse(responseContent);
  } catch (error) {
    logger.error({ err: error }, 'Error analyzing review');
    return createFallbackResponse();
  }
}

async function callOpenAI(reviewText: string): Promise<string> {
  const openaiClient = getOpenAIClient();
  const request = createCompletionRequest(reviewText);

  const completion = (await openaiClient.chat.completions.create(
    request
  )) as OpenAI.Chat.ChatCompletion;
  return extractResponseContent(completion);
}

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const config = getConfig();
    openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }
  return openai;
}

function createCompletionRequest(reviewText: string) {
  const config = getConfig();

  return {
    model: config.OPENAI_MODEL,
    messages: [
      { role: 'system' as const, content: SYSTEM_REVIEW_CHECKER_PROMPT },
      { role: 'user' as const, content: userReviewPrompt(reviewText) },
    ],
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'ReviewAnalysis',
        schema: reviewCheckerJsonSchema,
        strict: true,
      },
    },
    temperature: 0.3,
  };
}

function extractResponseContent(
  completion: OpenAI.Chat.ChatCompletion
): string {
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }
  return content;
}

function parseAnalysisResponse(responseContent: string): ReviewChecker {
  const rawAnalysis = JSON.parse(responseContent);
  logger.debug({ rawAnalysis }, 'Raw OpenAI response');

  const analysis = ReviewCheckerSchema.parse(rawAnalysis);
  return analysis as ReviewChecker;
}

function createFallbackResponse(): ReviewChecker {
  return {
    isFake: false,
    confidence: 0,
    reasons: ['Analysis failed - unable to determine authenticity'],
    flags: [] as ReviewFlag[],
    summary: 'Could not analyze review due to service error',
  };
}

const reviewFlagValues = Object.values(ReviewFlag) as [string, ...string[]];

const ReviewCheckerSchema = z.object({
  isFake: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  flags: z.array(z.enum(reviewFlagValues)),
  summary: z.string(),
});

const reviewCheckerJsonSchema = zodToJsonSchema(ReviewCheckerSchema, {
  name: 'ReviewAnalysis',
  $refStrategy: 'none',
});

let openai: OpenAI;
