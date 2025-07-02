import type { FastifyReply, FastifyRequest } from 'fastify';

import type { HealthResponse } from '../types/generated/index.js';

export async function healthHandler(
  _request: FastifyRequest,
  _reply: FastifyReply
): Promise<HealthResponse> {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
