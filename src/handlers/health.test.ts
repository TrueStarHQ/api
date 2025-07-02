import { describe, it, expect } from 'vitest';
import { healthHandler } from './health.js';
import {
  createMockRequest,
  createMockReply,
} from '../../test/fastify-mocks.js';

describe('healthHandler', () => {
  it('returns ok status with timestamp', async () => {
    const mockRequest = createMockRequest();
    const mockReply = createMockReply();

    const result = await healthHandler(mockRequest, mockReply);

    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
