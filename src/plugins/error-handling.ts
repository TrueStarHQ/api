import type { FastifyInstance, FastifyError } from 'fastify';
import type { ErrorResponse } from '../types/generated/index.js';

declare module 'fastify' {
  interface FastifyReply {
    sendError(errorResponse: ErrorResponse): void;
  }
}

export async function errorHandlingPlugin(fastify: FastifyInstance) {
  fastify.decorateReply('sendError', function (errorResponse: ErrorResponse) {
    return this.status(errorResponse.statusCode).send(errorResponse);
  });

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ error }, 'Request error');

    let errorResponse: ErrorResponse;

    if (error.validation) {
      const details = error.validation
        .map((err) => `${err.instancePath || 'body'}: ${err.message}`)
        .join(', ');

      errorResponse = {
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        details,
        timestamp: new Date().toISOString(),
      };
    } else {
      const statusCode = error.statusCode || 500;
      errorResponse = {
        statusCode,
        error: error.code || 'INTERNAL_SERVER_ERROR',
        details: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    return reply.status(errorResponse.statusCode).send(errorResponse);
  });
}
