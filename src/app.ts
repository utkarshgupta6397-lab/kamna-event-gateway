import Fastify, { FastifyInstance } from 'fastify';
import { env } from './config/env';
import { eventRoutes } from './routes/events';
import { destinationRoutes } from './routes/destinations';
import { deliveryRoutes } from './routes/deliveries';
import { dispatcherRoutes } from './routes/dispatcher';
import { TransportRegistry } from './domain/transport';
import { HttpTransport } from './transports/httpTransport';

export const buildApp = (): FastifyInstance => {
  // Register default transports
  TransportRegistry.register('webhook', new HttpTransport());
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
      ...(env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
    },
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'kamna-event-gateway',
      version: '0.0.1',
    };
  });

  app.register(eventRoutes, { prefix: '/events' });
  app.register(destinationRoutes, { prefix: '/destinations' });
  app.register(deliveryRoutes, { prefix: '/deliveries' });
  app.register(dispatcherRoutes, { prefix: '/dispatch' });

  return app;
};
