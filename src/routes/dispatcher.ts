import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { dispatchDelivery } from '../services/dispatcherService';

export const dispatcherRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/:deliveryId', async (request, reply) => {
    const params = request.params as { deliveryId: string };
    const deliveryId = parseInt(params.deliveryId, 10);
    
    if (isNaN(deliveryId)) {
      return reply.status(400).send({ error: 'Invalid Delivery ID' });
    }

    try {
      const result = await dispatchDelivery(deliveryId);
      return reply.send({ delivery: result });
    } catch (err: unknown) {
      if (err instanceof Error) {
        return reply.status(400).send({ error: err.message });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
};
