import { describe, expect, it } from 'vitest';

import {
  createMockReply,
  createMockRequest,
} from '../../../test/fastify-mocks.js';
import { healthHandler } from './index.js';

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
