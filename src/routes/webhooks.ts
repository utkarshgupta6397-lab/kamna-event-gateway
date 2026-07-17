import { FastifyInstance } from 'fastify';
import { ProviderConfigurationService } from '../services/ProviderConfigurationService';
import { db } from '../db';
import { webhookEvents } from '../db/schema';
import { MetaWebhookProcessor } from '../services/metaWebhookProcessor';

export const webhookRoutes = async (fastify: FastifyInstance) => {
  
  // Meta Webhook Verification
  fastify.get('/meta', async (request, reply) => {
    const query = request.query as Record<string, string>;
    
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    
    if (mode === 'subscribe' && token) {
      const config = await ProviderConfigurationService.getMetaConfiguration();
      
      if (config && config.verifyToken === token) {
        // eslint-disable-next-line no-console
        console.log('WEBHOOK_VERIFIED');
        
        // Update DB asynchronously so we don't block the response
        // eslint-disable-next-line no-console
        ProviderConfigurationService.updateVerificationStatus('whatsapp', true).catch(e => console.error('Failed to update verification status', e));
        
        return reply.status(200).send(challenge);
      } else {
        return reply.status(403).send('Forbidden');
      }
    }
    
    return reply.status(400).send('Bad Request');
  });

  // Meta Webhook Receiver
  fastify.post('/meta', async (request, reply) => {
    const payload = request.body as Record<string, unknown>;
    
    // Store webhook in DB immediately
    const [inserted] = await db.insert(webhookEvents).values({
      provider: 'meta',
      rawPayload: payload,
      receivedAt: new Date(),
      createdAt: new Date(),
    }).returning();
    
    // Return 200 immediately
    reply.status(200).send('EVENT_RECEIVED');
    
    // Process asynchronously
    MetaWebhookProcessor.processWebhook(inserted.id).catch(err => {
      // eslint-disable-next-line no-console
      console.error(`Failed to process Meta webhook ${inserted.id}`, err);
    });
  });

};
