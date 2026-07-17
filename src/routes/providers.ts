import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { providerConfiguration } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../security/encryption';

export const providerRoutes = async (fastify: FastifyInstance) => {
  
  // Get Provider Configuration
  fastify.get('/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    
    const [config] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, provider));
    
    if (!config) {
      return reply.send({ configured: false });
    }

    const settings = (config.settingsJson as any) || {};
    
    // Mask the token
    if (settings.encryptedAccessToken) {
      settings.encryptedAccessToken = '********'; // Masked in UI
    }

    return reply.send({
      configured: true,
      enabled: config.enabled,
      isDefault: config.isDefault,
      settings
    });
  });

  // Update Provider Configuration
  fastify.put('/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const body = request.body as any;
    
    const [existing] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, provider));
    
    let settings = body.settings || {};
    
    // Handle Encryption
    if (settings.accessToken && settings.accessToken !== '********') {
      settings.encryptedAccessToken = encrypt(settings.accessToken);
    } else if (settings.accessToken === '********' && existing && existing.settingsJson) {
      settings.encryptedAccessToken = (existing.settingsJson as any).encryptedAccessToken;
    }
    
    // Don't save plaintext token
    delete settings.accessToken;

    if (existing) {
      await db.update(providerConfiguration)
        .set({
          enabled: body.enabled,
          isDefault: body.isDefault,
          settingsJson: settings,
          updatedAt: new Date()
        })
        .where(eq(providerConfiguration.provider, provider));
    } else {
      await db.insert(providerConfiguration).values({
        provider,
        enabled: body.enabled,
        isDefault: body.isDefault,
        settingsJson: settings,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return reply.send({ success: true });
  });

  // Test Connection
  fastify.post('/:provider/test', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    
    if (provider !== 'whatsapp') {
      return reply.status(400).send({ success: false, error: 'Test connection only supported for WhatsApp currently' });
    }

    const [config] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, provider));
    
    if (!config || !config.settingsJson) {
      return reply.status(400).send({ success: false, error: 'Provider not configured' });
    }

    const settings = config.settingsJson as any;
    const apiVersion = settings.apiVersion || 'v19.0';
    const phoneNumberId = settings.phoneNumberId;
    let accessToken = '';
    
    try {
      accessToken = decrypt(settings.encryptedAccessToken);
    } catch (e) {
      return reply.status(400).send({ success: false, error: 'Failed to decrypt access token' });
    }

    try {
      // Lightweight API call to fetch phone number details
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const json = await response.json();
      
      if (!response.ok) {
        return reply.status(400).send({ success: false, error: json.error?.message || 'Meta API Error' });
      }
      
      return reply.send({ success: true, details: json });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

};
