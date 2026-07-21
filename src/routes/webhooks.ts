import { FastifyInstance, FastifyRequest } from 'fastify';

interface CustomRequest extends FastifyRequest {
  rawBodyString?: string;
}
import { ProviderConfigurationService } from '../services/ProviderConfigurationService';
import { db } from '../db';
import { webhookEvents, providerWebhookLogs } from '../db/schema';
import { MetaWebhookProcessor } from '../services/metaWebhookProcessor';

export const webhookRoutes = async (fastify: FastifyInstance) => {
  
  // Custom JSON parser to NEVER throw on bad JSON and always capture raw payload
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body: string, done) => {
    try {
      const json = JSON.parse(body);
      (req as CustomRequest).rawBodyString = body;
      done(null, json);
    } catch (err) {
      (req as CustomRequest).rawBodyString = body;
      done(null, { _invalidJson: true });
    }
  });

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
    const payload = request.body as Record<string, unknown> & { _invalidJson?: boolean };
    const rawBody = (request as CustomRequest).rawBodyString || '';
    const isInvalid = payload?._invalidJson;

    // Store webhook in DB immediately
    const [insertedLog] = await db.insert(providerWebhookLogs).values({
      provider: 'meta',
      receivedAt: new Date(),
      httpMethod: request.method,
      requestUrl: request.url,
      headersJson: request.headers,
      bodyJson: isInvalid ? null : payload,
      rawBody: rawBody,
      ipAddress: request.ip,
      processingStatus: isInvalid ? 'Failed' : 'Received',
      errorMessage: isInvalid ? 'Invalid JSON Payload' : null,
      createdAt: new Date(),
    }).returning();
    
    // Also insert into old webhookEvents to not break existing engine for now
    if (!isInvalid) {
      const [inserted] = await db.insert(webhookEvents).values({
        provider: 'meta',
        rawPayload: payload,
        receivedAt: new Date(),
        createdAt: new Date(),
      }).returning();
      
      // Process asynchronously
      MetaWebhookProcessor.processWebhook(inserted.id, insertedLog.id).catch(err => {
        // eslint-disable-next-line no-console
        console.error(`Failed to process Meta webhook ${inserted.id}`, err);
      });
    }

    // Return 200 immediately
    reply.status(200).send('EVENT_RECEIVED');
  });

};
