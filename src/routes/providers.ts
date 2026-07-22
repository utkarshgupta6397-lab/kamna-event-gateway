import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { ProviderConfigurationService } from '../services/ProviderConfigurationService';
import { MetaApiService } from '../services/metaApiService';
import { ProviderIds } from '../constants/providers';

export const providerRoutes = async (fastify: FastifyInstance) => {
  
  // Get Provider Configuration
  fastify.get('/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    
    if (provider === ProviderIds.WHATSAPP) {
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
    
    if (provider === ProviderIds.WHATSAPP) {
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
    
    if (provider !== ProviderIds.WHATSAPP) {
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
      return reply.status(500).send({ success: false, error: (error as Error).message });
    }
  });

  // Get Approved Templates
  fastify.get('/whatsapp/templates', async (_request, reply) => {
    try {
      const templates = await MetaApiService.getTemplates();
      // Filter out only approved templates if needed, or return all
      // The requirement says: "Fetch approved templates". Let's filter by status.
      const approvedTemplates = templates.filter(t => t.status === 'APPROVED');
      return reply.send(approvedTemplates);
    } catch (error: unknown) {
      return reply.status(500).send({ success: false, error: (error as Error).message });
    }
  });

};
