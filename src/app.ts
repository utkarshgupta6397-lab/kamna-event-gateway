import Fastify, { FastifyInstance } from 'fastify';
import { env } from './config/env';
import { eventRoutes } from './routes/events';
import { destinationRoutes } from './routes/destinations';
import { deliveryRoutes } from './routes/deliveries';
import { dispatcherRoutes } from './routes/dispatcher';
import { debugRoutes } from './routes/debug';
import { TransportRegistry } from './domain/transport';
import { HttpTransport } from './transports/httpTransport';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyRawBody from 'fastify-raw-body';

export const buildApp = (): FastifyInstance => {
  // Register default transports
  TransportRegistry.register('webhook', new HttpTransport());
  TransportRegistry.register('http', new HttpTransport());
  const app = Fastify({
    bodyLimit: 5242880, // 5MB Limit
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
      formatters: {
        level: (label) => {
          return { level: label.toUpperCase() };
        },
      },
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

  // Enable raw body string on requests for webhooks
  app.register(fastifyRawBody, {
    field: 'rawBody', 
    global: false, 
    encoding: 'utf8', 
    runFirst: true 
  });

  // Configure Rate Limiting
  app.register(fastifyRateLimit, {
    max: 100, // 100 requests per minute per IP
    timeWindow: '1 minute'
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
  app.register(debugRoutes, { prefix: '/debug' });

  return app;
};
