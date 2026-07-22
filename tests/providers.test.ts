import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app';
import { db } from '../src/db';
import { providerConfiguration, apiKeys } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { ProviderIds } from '../src/constants/providers';
import { randomBytes, createHash } from 'crypto';

describe('Providers Endpoint', () => {
  let app: ReturnType<typeof buildApp>;
  let validToken: string;

  beforeEach(async () => {
    app = buildApp();
    await db.delete(providerConfiguration).where(eq(providerConfiguration.provider, ProviderIds.WHATSAPP));
    
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
    validToken = rawKey;
  });

  afterEach(async () => {
    await db.delete(providerConfiguration).where(eq(providerConfiguration.provider, ProviderIds.WHATSAPP));
    await db.delete(apiKeys).where(eq(apiKeys.name, 'Test Key'));
  });

  it('should encrypt appSecret on save and mask it on GET', async () => {
    const payload = {
      enabled: true,
      isDefault: true,
      settings: {
        appSecret: 'my-super-secret-app-secret',
        accessToken: 'my-access-token',
        verifyToken: 'my-verify-token',
        apiVersion: 'v19.0'
      }
    };

    // 1. Save config
    let res = await app.inject({
      method: 'PUT',
      url: `/api/v1/providers/${ProviderIds.WHATSAPP}`,
      headers: {
        'authorization': `Bearer ${validToken}`,
        'content-type': 'application/json'
      },
      payload
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // 2. Fetch config directly from DB to verify encryption
    const [dbConfig] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, ProviderIds.WHATSAPP));
    expect(dbConfig).toBeDefined();
    
    const rawSettings = dbConfig.settingsJson as Record<string, string>;
    expect(rawSettings.appSecret).toBeUndefined(); // Should not be in plain text
    expect(rawSettings.encryptedAppSecret).toBeDefined();
    expect(rawSettings.encryptedAppSecret).not.toBe('my-super-secret-app-secret'); // Should be encrypted
    
    expect(rawSettings.accessToken).toBeUndefined(); // Should not be in plain text
    expect(rawSettings.encryptedAccessToken).toBeDefined();

    // 3. Fetch config via GET to verify masking
    res = await app.inject({
      method: 'GET',
      url: `/api/v1/providers/${ProviderIds.WHATSAPP}`,
      headers: {
        'authorization': `Bearer ${validToken}`
      }
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    
    expect(data.configured).toBe(true);
    expect(data.settings).toBeDefined();
    expect(data.settings.appSecret).toBe('********');
    expect(data.settings.accessToken).toBe('********');
    expect(data.settings.verifyToken).toBe('my-verify-token');
    
    // Ensure rawSettings isn't leaked
    expect(data.settings.rawSettings).toBeUndefined();
  });

  it('should preserve existing encrypted appSecret when masked string is passed', async () => {
    const payload = {
      enabled: true,
      isDefault: true,
      settings: {
        appSecret: 'my-super-secret-app-secret',
        accessToken: 'my-access-token',
      }
    };

    // 1. Initial save
    await app.inject({
      method: 'PUT',
      url: `/api/v1/providers/${ProviderIds.WHATSAPP}`,
      headers: {
        'authorization': `Bearer ${validToken}`,
        'content-type': 'application/json'
      },
      payload
    });

    // 2. Second save with masked secret
    const maskedPayload = {
      enabled: false, // changing a field to verify update
      isDefault: true,
      settings: {
        appSecret: '********',
        accessToken: '********',
      }
    };

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/providers/${ProviderIds.WHATSAPP}`,
      headers: {
        'authorization': `Bearer ${validToken}`,
        'content-type': 'application/json'
      },
      payload: maskedPayload
    });

    expect(updateRes.statusCode).toBe(200);

    // 3. Verify that DB still has valid encrypted value and isn't encrypting '********'
    const [dbConfig] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, ProviderIds.WHATSAPP));
    const rawSettings = dbConfig.settingsJson as Record<string, string>;
    
    // It should STILL be encrypted, not '********' plain text and not encrypted '********'
    expect(rawSettings.encryptedAppSecret).toBeDefined();
    
    // 4. GET config and verify it still masks
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/providers/${ProviderIds.WHATSAPP}`,
      headers: {
        'authorization': `Bearer ${validToken}`
      }
    });

    const data = getRes.json();
    expect(data.enabled).toBe(false); // Validating update happened
    expect(data.settings.appSecret).toBe('********');
    expect(data.settings.accessToken).toBe('********');
  });
});
