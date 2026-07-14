import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';

describe('Health Endpoint', () => {
  it('should return health status', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'kamna-event-gateway',
      version: '0.0.1',
    });
  });
});
