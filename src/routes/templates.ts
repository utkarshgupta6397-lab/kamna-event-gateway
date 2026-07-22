/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { whatsappTemplates } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { MetaApiService } from '../services/metaApiService';
import { ProviderIds } from '../constants/providers';

import { MetaMapper } from '../mappers/metaMapper';

export const templateRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Get all templates from local DB
  app.get('/', async (_request, reply) => {
    try {
      const templates = await db.select().from(whatsappTemplates).orderBy(desc(whatsappTemplates.lastSyncedAt));
      return reply.send({ success: true, templates });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Manually trigger sync with Meta
  app.post('/sync', async (_request, reply) => {
    try {
      const templates = await MetaApiService.syncTemplates();
      return reply.send({ success: true, count: templates.length });
    } catch (error: any) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
    }
  });

  // Send a test message for a specific template
  app.post('/:name/test', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      
      const [template] = await db
        .select()
        .from(whatsappTemplates)
        .where(eq(whatsappTemplates.name, name))
        .limit(1);

      if (!template) {
        return reply.status(404).send({ success: false, error: 'Template not found locally' });
      }

      const components = typeof template.components === 'string' ? JSON.parse(template.components) : template.components;
      const requirements = MetaMapper.getTemplateRequirements(components);

      const payload: any = {
        channel: ProviderIds.WHATSAPP,
        recipient: '918744832318', // Default test number
        template: name,
        language: template.language,
        source: 'gateway-dashboard-template-test',
        requestedBy: 'developer',
        variables: Array.from({ length: requirements.expectedVariables }, (_, i) => `TEST_${i + 1}`)
      };

      if (requirements.requiresMedia) {
        // Generate a 10x10 valid PNG in memory to avoid strict dimensions rejection
        const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC';
        payload.metadata = {
          mediaBase64: base64Data
        };
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/messages/send',
        payload: payload,
        headers: {
          ...(request.headers.authorization ? { 'authorization': request.headers.authorization } : {})
        }
      });

      const responseJson = response.json();

      if (response.statusCode >= 400) {
         return reply.status(response.statusCode).send(responseJson);
      }

      return reply.send({ success: true, ...responseJson });

    } catch (error: any) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
    }
  });
};
