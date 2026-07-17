import { FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { AuthProvider } from './authProvider';
import { db } from '../db';
import { apiKeys } from '../db/schema';
import { eq } from 'drizzle-orm';

export class ApiKeyProvider implements AuthProvider {
  async authenticate(request: FastifyRequest): Promise<boolean> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer kgw_')) {
      return false; // Not handled by this provider
    }

    const rawKey = authHeader.split(' ')[1];
    if (!rawKey) return false;

    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    try {
      const [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash));
      
      if (!keyRecord || !keyRecord.enabled) {
        return false;
      }

      // Update lastUsedAt asynchronously
      db.update(apiKeys)
        .set({
          lastUsedAt: new Date(),
          lastUsedIp: request.ip
        })
        .where(eq(apiKeys.id, keyRecord.id))
        .catch(err => request.log.error(err, 'Failed to update API key lastUsedAt'));

      return true;
    } catch (err) {
      request.log.error({ err }, 'API Key authentication failed');
      return false;
    }
  }

  getChallengeHeader(): string | null {
    return null;
  }
}
