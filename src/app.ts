import Fastify, { FastifyInstance } from 'fastify';
import { env } from './config/env';
import { eventRoutes } from './routes/events';
import { destinationRoutes } from './routes/destinations';
import { deliveryRoutes } from './routes/deliveries';
import { dispatcherRoutes } from './routes/dispatcher';
import { debugRoutes } from './routes/debug';
import { authRoutes } from './routes/auth';
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
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(eventRoutes, { prefix: '/api/v1/events' });
  app.register(destinationRoutes, { prefix: '/api/v1/destinations' });
  app.register(deliveryRoutes, { prefix: '/api/v1/deliveries' });
  app.register(dispatcherRoutes, { prefix: '/api/v1/dispatch' });
  app.register(debugRoutes, { prefix: '/api/v1/debug' });
  
  // Register the new message routes inline to avoid import issues at top right now
  const { messageRoutes } = require('./routes/messages');
  app.register(messageRoutes, { prefix: '/api/v1/messages' });

  const { providerRoutes } = require('./routes/providers');
  app.register(providerRoutes, { prefix: '/api/v1/providers' });

  const { webhookRoutes } = require('./routes/webhooks');
  app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  // Serve Frontend conditionally
  const uiDistPath = path.join(__dirname, '../ui/dist');
  if (fs.existsSync(uiDistPath)) {
    app.register(fastifyStatic, {
      root: uiDistPath,
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const url = request.url;
    
    // Explicit 404 for missing APIs or Webhooks
    if (url.startsWith('/api/') || url.startsWith('/webhooks/')) {
      return reply.status(404).send({ error: 'Route not found' });
    }
    
    // SPA Fallback: Serve index.html for frontend routes
    const acceptsHtml = request.headers.accept?.includes('text/html');
    if (acceptsHtml && !url.startsWith('/assets/') && fs.existsSync(uiDistPath)) {
      return reply.sendFile('index.html');
    }

    // Default 404 for anything else (e.g. missing images, assets, bad requests)
    return reply.status(404).send({ error: 'Not found' });
  });

  return app;
};
