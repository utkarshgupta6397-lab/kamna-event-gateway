import { buildApp } from './app';
import { env } from './config/env';
import { db } from './db';
import { outboundMessages } from './db/schema';
import { inArray } from 'drizzle-orm';
import { CommunicationProcessor } from './services/communicationProcessor';
import { FastifyInstance } from 'fastify';

const resumeStuckMessages = async (app: FastifyInstance) => {
  try {
    const stuckMessages = await db.select()
      .from(outboundMessages)
      .where(inArray(outboundMessages.status, ['QUEUED', 'PROCESSING', 'VALIDATED']));
      
    if (stuckMessages.length > 0) {
      app.log.info(`Found ${stuckMessages.length} stuck outbound messages. Resuming...`);
      for (const msg of stuckMessages) {
        CommunicationProcessor.process(msg.messageId, msg.eventId, msg.source).catch(err => {
           app.log.error({ err }, `Error resuming message ${msg.messageId}`);
        });
      }
    }
  } catch (err) {
    app.log.error({ err }, 'Failed to resume stuck messages');
  }
};

const start = async () => {
  const app = buildApp();
  
  try {
    await app.listen({ port: parseInt(env.PORT, 10), host: env.HOST });
    app.log.info({
      msg: 'Server started',
      env: env.NODE_ENV,
      port: env.PORT,
      metaSignatureVerification: !!env.META_APP_SECRET
    });

    await resumeStuckMessages(app);

    const gracefulShutdown = async (signal: string) => {
      app.log.info({ signal }, 'Received termination signal, starting graceful shutdown...');
      try {
        await app.close();
        app.log.info('Server gracefully closed');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
