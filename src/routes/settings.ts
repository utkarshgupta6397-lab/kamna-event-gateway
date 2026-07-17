import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { apiKeys, NewApiKeyRecord } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const createKeySchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});

function generateApiKey() {
  const rawSecureBytes = crypto.randomBytes(36).toString('base64url'); // ~48 chars
  const rawKey = `kgw_${rawSecureBytes}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 8); // kgw_xxxx
  return { rawKey, keyHash, keyPrefix };
}

export const settingsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Get all keys (without raw key)
  app.get('/api-keys', async (_request, reply) => {
    try {
      const keys = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          lastUsedIp: apiKeys.lastUsedIp,
          enabled: apiKeys.enabled,
          notes: apiKeys.notes
        })
        .from(apiKeys)
        .orderBy(desc(apiKeys.createdAt));
      
      return reply.send({ success: true, apiKeys: keys });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Create new key
  app.post('/api-keys', async (request, reply) => {
    try {
      const body = createKeySchema.parse(request.body);
      const { rawKey, keyHash, keyPrefix } = generateApiKey();

      const record: NewApiKeyRecord = {
        name: body.name,
        notes: body.notes || null,
        keyHash,
        keyPrefix,
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: true,
      };

      const [inserted] = await db.insert(apiKeys).values(record).returning({ id: apiKeys.id });

      return reply.send({
        success: true,
        apiKey: {
          id: inserted.id,
          name: record.name,
          keyPrefix,
          createdAt: record.createdAt,
          enabled: true,
          notes: record.notes
        },
        rawKey // ONLY RETURNED ONCE
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation failed', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Regenerate
  app.post('/api-keys/:id/regenerate', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { rawKey, keyHash, keyPrefix } = generateApiKey();

      const [updated] = await db.update(apiKeys)
        .set({
          keyHash,
          keyPrefix,
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, parseInt(id, 10)))
        .returning({ id: apiKeys.id, name: apiKeys.name });

      if (!updated) {
        return reply.status(404).send({ success: false, error: 'API Key not found' });
      }

      return reply.send({
        success: true,
        rawKey, // returned once
        keyPrefix
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Enable
  app.patch('/api-keys/:id/enable', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await db.update(apiKeys).set({ enabled: true, updatedAt: new Date() }).where(eq(apiKeys.id, parseInt(id, 10)));
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Disable
  app.patch('/api-keys/:id/disable', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await db.update(apiKeys).set({ enabled: false, updatedAt: new Date() }).where(eq(apiKeys.id, parseInt(id, 10)));
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Delete
  app.delete('/api-keys/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await db.delete(apiKeys).where(eq(apiKeys.id, parseInt(id, 10)));
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
};
