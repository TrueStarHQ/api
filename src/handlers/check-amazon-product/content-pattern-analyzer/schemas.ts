const CONFIDENCE_SCHEMA = {
  type: 'number',
  minimum: 0,
  maximum: 1,
} as const;

const createFlagSchema = (
  type: string,
  details: { required?: string[]; properties: Record<string, unknown> }
) => ({
  type: 'object',
  properties: {
    type: { type: 'string', enum: [type] },
    confidence: CONFIDENCE_SCHEMA,
    details: {
      type: 'object',
      ...details,
    },
  },
  required: ['type', 'confidence', 'details'],
});

const RED_FLAG_SCHEMAS = [
  createFlagSchema('phrase_repetition', {
    required: ['phrase', 'reviewIds'],
    properties: {
      phrase: { type: 'string', description: 'The repeated phrase' },
      reviewIds: { type: 'array', items: { type: 'string' } },
    },
  }),
  createFlagSchema('excessive_positivity', {
    required: ['reviewIds'],
    properties: {
      reviewIds: { type: 'array', items: { type: 'string' } },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Common superlative keywords found',
      },
    },
  }),
];

export const ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    redFlags: {
      type: 'array',
      items: {
        oneOf: RED_FLAG_SCHEMAS,
      },
    },
  },
  required: ['redFlags'],
  additionalProperties: false,
};
