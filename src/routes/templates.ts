/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { whatsappTemplates } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { MetaApiService } from '../services/metaApiService';

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

      // Check if it's a media template
      const components = typeof template.components === 'string' ? JSON.parse(template.components) : template.components;
      const header = components.find((c: any) => c.type === 'HEADER');
      const isMedia = header && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(header.format);

      const payload: any = {
        channel: 'whatsapp',
        recipient: '918744832318', // Default test number
        template: name,
        language: template.language,
        source: 'gateway-dashboard-template-test',
        requestedBy: 'developer',
        variables: []
      };

      if (isMedia) {
        // Generate a 1x1 valid PNG in memory
        const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        payload.metadata = {
          mediaBase64: base64Data
        };
        // Provide dummy variables based on components (example: find max {{#}} in text)
        // For testing we will just pass a few dummy variables
        payload.variables = ['TEST1', 'TEST2', 'TEST3']; 
      }

      const selfHost = request.headers.host || 'localhost:3004';
      const protocol = request.protocol || 'http';
      const sendUrl = `${protocol}://${selfHost}/api/v1/messages/send`;

      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.authorization ? { 'Authorization': request.headers.authorization } : {})
        },
        body: JSON.stringify(payload)
      });

      const responseJson = await response.json();

      if (!response.ok) {
         return reply.status(response.status).send(responseJson);
      }

      return reply.send({ success: true, ...responseJson });

    } catch (error: any) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
    }
  });
};
