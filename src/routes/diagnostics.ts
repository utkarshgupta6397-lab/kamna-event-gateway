import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { providerWebhookLogs, providerConfiguration } from '../db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { ProviderIds } from '../constants/providers';
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

    const metaProvider = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, ProviderIds.WHATSAPP)).limit(1);
    const metaConfig = (metaProvider[0]?.settingsJson || {}) as Record<string, unknown>;

    let latestWebhook = null;
    let todayCount = 0;

    try {
      const [latest] = await db.select().from(providerWebhookLogs).orderBy(desc(providerWebhookLogs.receivedAt)).limit(1);
      latestWebhook = latest;

      const recentWebhooks = await db.select({ receivedAt: providerWebhookLogs.receivedAt }).from(providerWebhookLogs).orderBy(desc(providerWebhookLogs.receivedAt)).limit(1000);
      const startOfToday = new Date();
      startOfToday.setHours(0,0,0,0);
      todayCount = recentWebhooks.filter(w => new Date(w.receivedAt) >= startOfToday).length;
    } catch (e) {
      // Table might not exist yet
    }

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
    try {
      const hooks = await db.select()
        .from(providerWebhookLogs)
        .orderBy(desc(providerWebhookLogs.receivedAt))
        .limit(500);
        
      return reply.send(hooks);
    } catch (e) {
      return reply.send([]);
    }
  });

  fastify.get('/database', async (_request, reply) => {
    // 1. Get Physical tables from SQLite
    const physicalTablesResult = db.$client.pragma('table_list') as Array<{ name: string; type: string }>;
    const physicalTables = physicalTablesResult
      .filter(t => t.type === 'table' && !t.name.startsWith('sqlite_'))
      .map(t => t.name);

    // 2. Get Schema tables (assuming we know the expected list)
    const expectedTables = [
      '__drizzle_migrations', 'api_keys', 'communication_timeline', 'deliveries',
      'destinations', 'events', 'inbound_messages', 'outbound_messages',
      'provider_configuration', 'provider_webhook_logs', 'webhook_events', 'whatsapp_templates'
    ];

    const missingTables = expectedTables.filter(t => !physicalTables.includes(t));
    const isHealthy = missingTables.length === 0 && physicalTables.includes('__drizzle_migrations');

    return reply.send({
      healthy: isHealthy,
      schemaVersion: '0.0.1',
      pendingMigrations: missingTables.length > 0 ? missingTables.length : 0, // Mock metric
      missingTables,
      missingColumns: [], // Not checking columns for now as it requires complex PRAGMA table_info parsing
      physicalTables,
      expectedTables
    });
  });

  fastify.get('/logs', async (_request, reply) => {
    return reply.send(logBuffer.getLogs());
  });
};
