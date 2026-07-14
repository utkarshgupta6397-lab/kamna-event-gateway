import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as destinationService from '../services/destinationService';
import { z } from 'zod';
import { DestinationType, AuthenticationConfig } from '../domain/destination';

// We do manual casting because Fastify doesn't natively integrate Zod types at this basic route level without plugins.
const createDestinationSchema = z.object({
  name: z.string(),
  type: z.enum(['webhook', 'kafka']).optional(),
  url: z.string().url(),
  enabled: z.boolean().optional(),
  priority: z.number().optional(),
  timeoutMs: z.number().optional(),
  headers: z.record(z.string()).optional().nullable(),
  authentication: z.any().optional().nullable(),
});

export const destinationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  app.get('/', async (_request, reply) => {
    const records = await destinationService.getDestinations();
    return reply.send({ destinations: records });
  });

  app.post('/', async (request, reply) => {
    try {
      const data = createDestinationSchema.parse(request.body);
      const newRecord = await destinationService.createDestination({
        name: data.name,
        type: data.type as DestinationType | undefined,
        url: data.url,
        enabled: data.enabled,
        priority: data.priority,
        timeoutMs: data.timeoutMs,
        headers: data.headers,
        authentication: data.authentication as AuthenticationConfig | undefined | null,
      });
      return reply.status(201).send({ destination: newRecord });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation Error', details: err.errors });
      }
      throw err;
    }
  });

  app.patch('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'Invalid ID' });
    }

    // We can reuse the same schema but make it partial for PATCH
    const partialData = createDestinationSchema.partial().parse(request.body);
    
    const record = await destinationService.getDestinationById(id);
    if (!record) {
      return reply.status(404).send({ error: 'Destination not found' });
    }

    const updated = await destinationService.updateDestination(id, partialData);
    return reply.send({ destination: updated });
  });

  app.delete('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'Invalid ID' });
    }

    const deleted = await destinationService.deleteDestination(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Destination not found' });
    }
    
    return reply.send({ success: true, destination: deleted });
  });
};
