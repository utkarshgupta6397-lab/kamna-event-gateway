import { FastifyInstance } from 'fastify';
import { ProviderConfigurationService } from '../services/ProviderConfigurationService';

export const webhookRoutes = async (fastify: FastifyInstance) => {
  
  // Meta Webhook Verification
  fastify.get('/meta', async (request, reply) => {
    const query = request.query as any;
    
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    
    if (mode === 'subscribe' && token) {
      const config = await ProviderConfigurationService.getMetaConfiguration();
      
      if (config && config.verifyToken === token) {
        console.log('WEBHOOK_VERIFIED');
        
        // Update DB asynchronously so we don't block the response
        ProviderConfigurationService.updateVerificationStatus('whatsapp', true).catch(e => console.error('Failed to update verification status', e));
        
        return reply.status(200).send(challenge);
      } else {
        return reply.status(403).send('Forbidden');
      }
    }
    
    return reply.status(400).send('Bad Request');
  });

};
