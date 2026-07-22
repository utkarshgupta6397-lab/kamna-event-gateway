import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { providerConfiguration, apiKeys } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { ProviderIds } from '../src/constants/providers';
import { randomBytes, createHash } from 'crypto';

describe('Diagnostics Endpoint', () => {
  beforeEach(async () => {
    await db.delete(providerConfiguration).where(eq(providerConfiguration.provider, ProviderIds.WHATSAPP));
  });

  afterEach(async () => {
    await db.delete(providerConfiguration).where(eq(providerConfiguration.provider, ProviderIds.WHATSAPP));
  });

  it('should successfully read saved WhatsApp provider configuration', async () => {
    const app = buildApp();
    
    // 1. Save dummy configuration using the ProviderIds.WHATSAPP
    await db.insert(providerConfiguration).values({
      provider: ProviderIds.WHATSAPP,
      enabled: true,
      isDefault: true,
      settingsJson: {
        webhookUrl: 'https://example.com/webhook',
        webhookVerified: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const rawKey = 'kgw_' + randomBytes(28).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    
    await db.insert(apiKeys).values({
      name: 'Test Key',
      keyHash,
      keyPrefix: rawKey.substring(0, 8),
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    });

    // 2. Query diagnostics state
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/diagnostics/state',
      headers: {
        'authorization': `Bearer ${rawKey}`
      }
    });

    expect(response.statusCode).toBe(200);
    const state = response.json();
    
    // 3. Verify it picks up the correct config
    expect(state.meta).toBeDefined();
    expect(state.meta.webhookUrl).toBe('https://example.com/webhook');
    expect(state.meta.webhookVerified).toBe(true);
  });
});
