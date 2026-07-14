import Fastify, { FastifyInstance } from 'fastify';
import { env } from './config/env';

export const buildApp = (): FastifyInstance => {
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

  return app;
};
