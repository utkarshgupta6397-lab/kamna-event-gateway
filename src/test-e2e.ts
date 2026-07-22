/* eslint-disable no-console */

import { buildApp } from './app';
import { config } from 'dotenv';
import { ProviderIds } from './constants/providers';
import { Buffer } from 'buffer';
import { db } from './db';
import { apiKeys } from './db/schema';
import crypto from 'crypto';

async function runE2E() {
  console.log('Starting E2E Test...');
  const app = buildApp();
  await app.ready();

  // Create a temporary API key for testing
  const rawKey = 'kgw_testkey12345678901234567890123456789012345678';
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 8);
  
  await db.insert(apiKeys).values({
    name: 'E2E Test Key',
    keyHash,
    keyPrefix,
    createdBy: 'test',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const dummyImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const base64Data = `data:image/png;base64,${dummyImage.toString('base64')}`;

  const payload = {
    channel: ProviderIds.WHATSAPP,
    recipient: '1234567890',
    template: 'dcr_issued_v1',
    language: 'en',
    variables: ['KT/26-27/1233'],
    metadata: {
      mediaBase64: base64Data
    },
    requestedBy: 'e2e-tester',
    source: 'e2e-script'
  };

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      headers: {
        'Authorization': `Bearer ${rawKey}`
      },
      payload
    });

    const result = response.json();
    console.log('Response:', result);
    
    if (result.success) {
      console.log('Message queued successfully. Message ID:', result.gatewayMessageId);
      
      console.log('Waiting 5 seconds for async processing engine to finish...');
      await new Promise(r => setTimeout(r, 5000));
      
      const checkResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/messages/${result.gatewayMessageId}`,
        headers: {
          'Authorization': `Bearer ${rawKey}`
        }
      });
      const checkResult = checkResponse.json();
      console.log('Final Status:', checkResult.message?.status);
      console.log('Timeline:', JSON.stringify(checkResult.message?.timeline, null, 2));
    }
  } catch (err) {
    console.error('Error running E2E:', err);
  } finally {
    // Cleanup DB
    const { eq } = await import('drizzle-orm');
    await db.delete(apiKeys).where(eq(apiKeys.keyPrefix, keyPrefix));
    
    await app.close();
  }
}

runE2E();
