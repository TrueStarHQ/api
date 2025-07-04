import type { HealthResponse } from '@truestarhq/shared-types';
import type { FastifyReply, FastifyRequest } from 'fastify';

export async function healthHandler(
  _request: FastifyRequest,
  _reply: FastifyReply
): Promise<HealthResponse> {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
