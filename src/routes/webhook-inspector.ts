import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { providerWebhookLogs } from '../db/schema';
import { desc, or, like, eq, and, sql } from 'drizzle-orm';

export const webhookInspectorRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/', async (request, reply) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
      eventType?: string;
    };

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push(
        or(
          like(providerWebhookLogs.matchedProviderMessageId, search),
          like(providerWebhookLogs.matchedCommunicationId, search),
          like(providerWebhookLogs.rawBody, search)
        )
      );
    }

    if (query.status && query.status !== 'All') {
      conditions.push(eq(providerWebhookLogs.processingStatus, query.status));
    }

    if (query.eventType && query.eventType !== 'All') {
      conditions.push(eq(providerWebhookLogs.eventType, query.eventType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db.select()
      .from(providerWebhookLogs)
      .where(whereClause)
      .orderBy(desc(providerWebhookLogs.receivedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(providerWebhookLogs)
      .where(whereClause);

    return reply.send({
      data: logs,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  });

  fastify.delete('/prune', async (_request, reply) => {
    // Keep minimum 10,000 webhook records
    const keepLimit = 10000;
    
    // Find the ID of the 10,000th newest record
    const records = await db.select({ id: providerWebhookLogs.id })
      .from(providerWebhookLogs)
      .orderBy(desc(providerWebhookLogs.id))
      .limit(1)
      .offset(keepLimit);

    if (records.length > 0) {
      const thresholdId = records[0].id;
      // Delete everything older (smaller ID) than threshold
      await db.delete(providerWebhookLogs)
        .where(sql`${providerWebhookLogs.id} < ${thresholdId}`);
    }

    return reply.send({ success: true });
  });
};
