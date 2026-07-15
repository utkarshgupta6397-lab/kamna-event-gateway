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
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'kamna-event-gateway',
      version: '0.0.1',
    });
    expect(response.json()).toHaveProperty('uptime');
    expect(response.json()).toHaveProperty('environment');
    expect(response.json()).toHaveProperty('nodeVersion');
  });
});
