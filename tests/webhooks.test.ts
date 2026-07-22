import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { buildApp } from '../src/app';
import { verifyMetaSignature } from '../src/routes/webhooks';

describe('Public Webhook & Meta Signature Authentication', () => {
  it('should bypass Gateway authentication for /api/v1/webhooks/meta without JWT or API Key', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/meta',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        object: 'whatsapp_business_account',
        entry: [],
      },
    });

    // Must NOT return 401 Unauthorized
    expect(response.statusCode).not.toBe(401);
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('EVENT_RECEIVED');
  });

  it('should enforce Gateway authentication on protected API routes like /api/v1/events', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/events',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      message: 'Unauthorized',
    });
  });

  it('should correctly compute and verify valid Meta HMAC SHA256 signatures', () => {
    const secret = 'my_test_meta_app_secret_12345';
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    const validHeader = `sha256=${computedHmac}`;
    const result = verifyMetaSignature(validHeader, payload, secret);

    expect(result.signaturePresent).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.signatureAlgorithm).toBe('sha256');
    expect(result.validationError).toBeUndefined();
  });

  it('should reject invalid Meta HMAC SHA256 signatures', () => {
    const secret = 'my_test_meta_app_secret_12345';
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

    const invalidHeader = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
    const result = verifyMetaSignature(invalidHeader, payload, secret);

    expect(result.signaturePresent).toBe(true);
    expect(result.signatureValid).toBe(false);
    expect(result.signatureAlgorithm).toBe('sha256');
    expect(result.validationError).toContain('Signature hash does not match');
  });

  it('should reject requests with invalid Meta signature when App Secret is set', async () => {
    // Set META_APP_SECRET in environment for test
    process.env.META_APP_SECRET = 'test_secret_321';
    
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/meta',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=badsignature000000000000000000000000000000000000000000000000000000',
      },
      payload: {
        object: 'whatsapp_business_account',
        entry: [],
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      error: 'Forbidden: Invalid signature',
    });

    delete process.env.META_APP_SECRET;
  });

  it('should accept requests with valid Meta signature when App Secret is set', async () => {
    const secret = 'test_secret_321';
    process.env.META_APP_SECRET = secret;
    const bodyObj = { object: 'whatsapp_business_account', entry: [] };
    const rawBody = JSON.stringify(bodyObj);

    const validHash = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/meta',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': `sha256=${validHash}`,
      },
      payload: bodyObj,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('EVENT_RECEIVED');

    delete process.env.META_APP_SECRET;
  });
});
