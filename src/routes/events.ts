import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import * as eventService from '../services/eventService';

export const eventRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/test', async (request, reply) => {
    const start = process.hrtime();
    const requestId = uuidv4();
    
    // Store incoming request
    await eventService.createEvent({
      requestId,
      method: request.method,
      path: request.url,
      headers: request.headers,
      query: request.query as Record<string, unknown>,
      body: request.body || null,
      sourceIp: request.ip,
      receivedAt: new Date(),
      status: 'received',
    });

    const diff = process.hrtime(start);
    const processingTimeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
    
    request.log.info({ processingTimeMs, requestId }, 'Event stored successfully');

    return reply.status(201).send({
      success: true,
      requestId,
    });
  });

  app.get('/', async (_request, reply) => {
    const latestEvents = await eventService.getEvents();
    return reply.send({ events: latestEvents });
  });

  app.get('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'Invalid ID' });
    }

    const event = await eventService.getEventById(id);
    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    return reply.send({ event });
  });
};
