import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { ProviderConfigurationService } from '../services/ProviderConfigurationService';

export const providerRoutes = async (fastify: FastifyInstance) => {
  
  // Get Provider Configuration
  fastify.get('/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    
    if (provider === 'whatsapp') {
      const config = await ProviderConfigurationService.getMetaConfiguration();
      if (!config) {
        return reply.send({ configured: false });
      }

      const settings = config.rawSettings || {};
      if (settings.encryptedAccessToken) {
        settings.encryptedAccessToken = '********';
      }
      
      // Don't leak raw encrypted token if not needed, we pass the masked settings back
      return reply.send({
        configured: true,
        enabled: config.enabled,
        isDefault: config.isDefault,
        settings
      });
    }

    return reply.status(404).send({ error: 'Provider not found' });
  });

  // Update Provider Configuration
  fastify.put('/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const body = request.body as Record<string, unknown>;
    
    if (provider === 'whatsapp') {
      await ProviderConfigurationService.saveMetaConfiguration(body);
      return reply.send({ success: true });
    }
    
    return reply.status(404).send({ error: 'Provider not found' });
  });

  // Generate Webhook Verify Token
  fastify.post('/whatsapp/generate-verify-token', async (_request, reply) => {
    const token = `kt_verify_${crypto.randomBytes(24).toString('base64url')}`;
    
    // Partially save just the token if the record doesn't exist, or update existing.
    // ProviderConfigurationService.saveMetaConfiguration expects a full payload. We can fetch existing first.
    let config: Record<string, unknown> | null = await ProviderConfigurationService.getMetaConfiguration();
    if (!config) {
      config = { enabled: false, isDefault: false, settings: {} };
    }
    
    await ProviderConfigurationService.saveMetaConfiguration({
      enabled: config.enabled,
      isDefault: config.isDefault,
      settings: {
        ...config,
        accessToken: config.accessToken ? '********' : '', // preserve access token state
        verifyToken: token,
        webhookVerified: false, // Reset verification status
        lastVerificationAt: null
      }
    });
    
    return reply.send({ success: true, verifyToken: token });
  });

  // Test Connection
  fastify.post('/:provider/test', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    
    if (provider !== 'whatsapp') {
      return reply.status(400).send({ success: false, error: 'Test connection only supported for WhatsApp currently' });
    }

    const config = await ProviderConfigurationService.getMetaConfiguration();
    
    if (!config) {
      return reply.status(400).send({ success: false, error: 'Provider not configured' });
    }

    const apiVersion = config.apiVersion || 'v19.0';
    const phoneNumberId = config.phoneNumberId;
    const accessToken = config.accessToken;
    
    if (!accessToken) {
      return reply.status(400).send({ success: false, error: 'Access token not available' });
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
    } catch (error: unknown) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

};
