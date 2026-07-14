import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as deliveryService from '../services/deliveryService';

export const deliveryRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  app.get('/', async (_request, reply) => {
    const records = await deliveryService.getDeliveries();
    return reply.send({ deliveries: records });
  });

  app.get('/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'Invalid ID' });
    }

    const record = await deliveryService.getDeliveryById(id);
    if (!record) {
      return reply.status(404).send({ error: 'Delivery not found' });
    }

    return reply.send({ delivery: record });
  });
};
