import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const debugRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/receiver/a', async (request, reply) => {
    request.log.info({
      timestamp: new Date().toISOString(),
      headers: request.headers,
      body: request.body,
    }, 'Debug Receiver A invoked');

    return reply.status(200).send({
      success: true,
      receiver: 'A',
    });
  });

  app.post('/receiver/b', async (request, reply) => {
    request.log.info({
      timestamp: new Date().toISOString(),
      headers: request.headers,
      body: request.body,
    }, 'Debug Receiver B invoked');

    return reply.status(200).send({
      success: true,
      receiver: 'B',
    });
  });
};
