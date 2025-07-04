import type { ErrorResponse } from '@truestarhq/shared-types';
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { FastifySchemaValidationError } from 'fastify/types/schema.js';

import { getConfig } from '../config/config.js';

export async function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler(handleError);
  fastify.decorateReply('sendError', sendError);
}

function handleError(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error({ error }, 'Request error');

  const statusCode = error.statusCode || 500;
  let errorCode: string;
  let details: string;

  if (error.validation) {
    // Validation errors are safe to expose and help API users fix their input
    errorCode = 'VALIDATION_ERROR';
    details = formatValidationErrors(error.validation);
  } else {
    errorCode = error.code || 'INTERNAL_SERVER_ERROR';
    details = getSafeErrorMessage(error);
  }

  const errorResponse: ErrorResponse = {
    statusCode,
    error: errorCode,
    details,
    timestamp: new Date().toISOString(),
  };

  return reply.status(errorResponse.statusCode).send(errorResponse);
}

function getSafeErrorMessage(error: FastifyError): string {
  const safeMessages: Record<string, string> = {
    FST_ERR_CTP_EMPTY_JSON_BODY: 'Invalid request body',
    FST_ERR_CTP_INVALID_JSON: 'Invalid JSON format',
    FST_ERR_CTP_INVALID_CONTENT_LENGTH: 'Invalid content length',
    ECONNREFUSED: 'Service temporarily unavailable',
    ETIMEDOUT: 'Request timeout',
    ENOTFOUND: 'Service unavailable',
  };

  let safeMessage: string;
  if (error.code && error.code in safeMessages) {
    safeMessage = safeMessages[error.code]!;
  } else {
    safeMessage = 'An error occurred processing your request';
  }

  if (getConfig().NODE_ENV === 'development') {
    safeMessage = `${safeMessage} (DEBUG: ${error.message})`;
  }

  return safeMessage;
}

function formatValidationErrors(
  validationErrors: FastifySchemaValidationError[]
): string {
  return validationErrors
    .map((err) => {
      const field = err.instancePath || 'body';
      return `${field}: ${err.message}`;
    })
    .join(', ');
}

function sendError(this: FastifyReply, errorResponse: ErrorResponse) {
  return this.status(errorResponse.statusCode).send(errorResponse);
}

declare module 'fastify' {
  interface FastifyReply {
    sendError(errorResponse: ErrorResponse): void;
  }
}
