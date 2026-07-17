import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as eventService from '../services/eventService';
import * as destinationService from '../services/destinationService';
import * as deliveryService from '../services/deliveryService';
import { dispatchDelivery } from '../services/dispatcherService';
import { HttpEventNormalizer, EventFactory } from '../domain/event';
import { DeliveryPlanner } from '../domain/delivery';
import { verifyMetaSignature } from '../plugins/metaSignature';
import { sseService } from '../services/sse';

export const eventRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const normalizer = new HttpEventNormalizer();

  // SSE Live Endpoint
  app.get('/live', async (request, reply) => {
    sseService.handleConnection(request, reply);
    // Return the reply and let the connection remain open
    return reply;
  });

  // Generic Event Publishing API
  app.post('/publish', async (request, reply) => {
    const body = request.body as { source?: string, type?: string, payload?: unknown };
    
    // Validation
    if (!body || !body.source || !body.type || !body.payload) {
      return reply.status(400).send({
        success: false,
        error: 'Validation Error: source, type, and payload are required.'
      });
    }

    const { source, type, payload } = body;

    // Enrich and create domain event
    const metadata = {
      sourceIp: request.ip,
      headers: request.headers,
      path: request.url,
      method: request.method,
      query: request.query as Record<string, unknown>
    };

    const domainEvent = EventFactory.create(source, type, payload, metadata);
    
    // Store enriched event
    const start = process.hrtime();
    const persistedEvent = await eventService.persistEvent(domainEvent);
    const diff = process.hrtime(start);
    const processingTimeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    request.log.info({ processingTimeMs, eventId: domainEvent.eventId }, 'Event published successfully');

    return reply.status(200).send({
      success: true,
      event: persistedEvent
    });
  });

  app.post(
    '/test',
    {
      config: {
        rawBody: true, // required for fastify-raw-body to populate request.rawBody
      },
      preHandler: [verifyMetaSignature]
    },
    async (request, reply) => {
    const start = process.hrtime();
    
    // Domain modeling: Convert raw HTTP request to abstract Event
    const domainEvent = normalizer.normalize(request);
    
    // Store normalized event
    await eventService.persistEvent(domainEvent);

    // Delivery Planning Phase
    const enabledDestinations = await destinationService.getEnabledDestinations();
    const destinations = enabledDestinations.map(d => ({
      ...d,
      type: d.type as 'webhook' | 'kafka' | 'http',
      headers: d.headers as Record<string, string> | null,
      authentication: d.authentication as import('../domain/destination').AuthenticationConfig | null,
    }));
    
    const plannedDeliveries = DeliveryPlanner.planDeliveries(domainEvent, destinations);
    
    if (plannedDeliveries.length > 0) {
      const insertedDeliveries = await deliveryService.createDeliveries(plannedDeliveries);
      
      // Auto-Dispatch Phase (Synchronous Fan-out)
      // We dispatch all created deliveries concurrently
      await Promise.all(
        insertedDeliveries.map((delivery) => dispatchDelivery(delivery.id))
      );
    }

    const diff = process.hrtime(start);
    const processingTimeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
    
    request.log.info({ processingTimeMs, eventId: domainEvent.eventId }, 'Event normalized, stored, and auto-dispatched');

    // Return 200 OK as per MVP requirements
    return reply.status(200).send({
      success: true,
      requestId: domainEvent.eventId,
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

  app.get('/:eventId/deliveries', async (request, reply) => {
    const params = request.params as { eventId: string };
    const records = await deliveryService.getDeliveriesByEventId(params.eventId);
    return reply.send({ deliveries: records });
  });
};
