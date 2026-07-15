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
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from './security/authMiddleware';

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
      uptime: process.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };
  });

  // Security Layer (Authentication)
  app.addHook('onRequest', authMiddleware);

  // Prefix all API routes with /api/v1
  app.register(eventRoutes, { prefix: '/api/v1/events' });
  app.register(destinationRoutes, { prefix: '/api/v1/destinations' });
  app.register(deliveryRoutes, { prefix: '/api/v1/deliveries' });
  app.register(dispatcherRoutes, { prefix: '/api/v1/dispatch' });
  app.register(debugRoutes, { prefix: '/api/v1/debug' });

  // Serve Frontend conditionally
  const uiDistPath = path.join(__dirname, '../ui/dist');
  if (fs.existsSync(uiDistPath)) {
    app.register(fastifyStatic, {
      root: uiDistPath,
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      reply.status(404).send({ error: 'API route not found' });
    } else if (fs.existsSync(uiDistPath)) {
      reply.sendFile('index.html');
    } else {
      reply.status(404).send({ error: 'Not found' });
    }
  });

  return app;
};
