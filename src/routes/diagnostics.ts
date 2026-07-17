import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { webhookEvents, providerConfiguration } from '../db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { sseService } from '../services/sse';
import { logBuffer } from '../services/loggerBuffer';
import os from 'os';

export const diagnosticsRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/state', async (_request, reply) => {
    let dbConnected = true;
    try {
      await db.select({ count: sql`1` }).from(providerConfiguration).limit(1);
    } catch {
      dbConnected = false;
    }

    const metaProvider = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, 'meta_whatsapp')).limit(1);
    const metaConfig = (metaProvider[0]?.settingsJson || {}) as Record<string, unknown>;

    const [latestWebhook] = await db.select().from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(1);
    
    // Approximation for today's webhook count (fetching last 1000 and filtering)
    const recentWebhooks = await db.select({ receivedAt: webhookEvents.receivedAt }).from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(1000);
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const todayCount = recentWebhooks.filter(w => new Date(w.receivedAt) >= startOfToday).length;

    const sseStats = sseService.getDiagnostics();
    const mem = process.memoryUsage();
    
    return reply.send({
      health: {
        apiServer: true,
        databaseConnected: dbConnected,
        eventBusRunning: true,
        dispatcherRunning: true,
        sseEventStream: sseStats.connected,
        authentication: true
      },
      meta: {
        webhookUrl: metaConfig.webhookUrl || 'Not Configured',
        webhookVerified: metaConfig.webhookVerified || false,
        lastVerificationTime: metaConfig.lastVerificationAt || null,
        lastIncomingWebhook: latestWebhook?.receivedAt || null,
        incomingWebhookCountToday: todayCount
      },
      observatory: sseStats,
      system: {
        uptime: process.uptime(),
        memoryUsage: mem.heapUsed,
        memoryTotal: mem.heapTotal,
        cpu: os.loadavg(),
        activeConnections: sseStats.connectedClients,
        eventsBuffered: logBuffer.getLogs().length,
        eventsPerSec: 0,
        dispatcherQueue: 0,
        pendingDeliveries: 0
      }
    });
  });

  fastify.get('/webhooks', async (_request, reply) => {
    const hooks = await db.select()
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.receivedAt))
      .limit(500);
      
    return reply.send(hooks);
  });

  fastify.get('/logs', async (_request, reply) => {
    return reply.send(logBuffer.getLogs());
  });
};
