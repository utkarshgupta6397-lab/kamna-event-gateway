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

const backfillProviderWebhookLogs = async (app: FastifyInstance) => {
  try {
    const { providerWebhookLogs, webhookEvents } = await import('./db/schema');
    const { sql } = await import('drizzle-orm');
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(providerWebhookLogs);
    if (count === 0) {
      const [{ legacyCount }] = await db.select({ legacyCount: sql<number>`count(*)` }).from(webhookEvents);
      if (legacyCount > 0) {
        app.log.info(`Found ${legacyCount} legacy webhooks. Backfilling to provider_webhook_logs...`);
        const legacyEvents = await db.select().from(webhookEvents);
        
        for (const ev of legacyEvents) {
          try {
            await db.insert(providerWebhookLogs).values({
              provider: ev.provider,
              receivedAt: ev.receivedAt,
              httpMethod: 'POST',
              requestUrl: '/api/v1/webhooks/meta',
              headersJson: {},
              bodyJson: ev.rawPayload,
              rawBody: typeof ev.rawPayload === 'object' ? JSON.stringify(ev.rawPayload) : '',
              ipAddress: '127.0.0.1',
              processingStatus: ev.processingError ? 'Failed' : 'Completed',
              matchedProviderMessageId: ev.providerMessageId,
              eventType: ev.eventType,
              errorMessage: ev.processingError,
              createdAt: ev.createdAt
            });
          } catch (e) {
            app.log.error({ err: e }, `Failed to backfill webhook ${ev.id}`);
          }
        }
        app.log.info('Backfill complete.');
      }
    }
  } catch (err) {
    app.log.error({ err }, 'Failed to backfill provider_webhook_logs');
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
    await backfillProviderWebhookLogs(app);

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
