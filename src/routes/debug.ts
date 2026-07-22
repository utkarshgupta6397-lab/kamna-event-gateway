/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { EventBus, EventType } from '../services/eventBus';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { ProviderIds } from '../constants/providers';
import { outboundMessages } from '../db/schema';
import { desc } from 'drizzle-orm';

export const debugRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/receiver/a', async (request, reply) => {
    request.log.info({
      timestamp: new Date().toISOString(),
      headers: request.headers,
      body: request.body,
    }, 'Debug Receiver A invoked');

    return reply.status(200).send({
      success: true,
      receiver: 'A',
    });
  });

  app.post('/receiver/b', async (request, reply) => {
    request.log.info({
      timestamp: new Date().toISOString(),
      headers: request.headers,
      body: request.body,
    }, 'Debug Receiver B invoked');

    return reply.status(200).send({
      success: true,
      receiver: 'B',
    });
  });

  app.post('/sse/ping', async (_request, _reply) => {
    EventBus.publish(EventType.EVENT_RECEIVED, {
      type: EventType.EVENT_RECEIVED,
      event: { eventId: uuidv4(), type: 'ping', payload: { message: 'Ping from Gateway' }, receivedAt: new Date() }
    });
    return { success: true };
  });

  app.post('/sse/broadcast', async (request, _reply) => {
    const body = request.body as Record<string, unknown>;
    const count = (body?.count as number) || 1;
    for (let i = 0; i < count; i++) {
      EventBus.publish(EventType.EVENT_RECEIVED, {
        type: EventType.EVENT_RECEIVED,
        event: { eventId: uuidv4(), type: 'test', payload: { testEventNumber: i }, receivedAt: new Date() }
      });
    }
    return { success: true, count };
  });

  app.post('/simulate/meta', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const type = body?.type as string;
    
    // Find a real outbound message to link to, if possible
    const [lastMsg] = await db.select().from(outboundMessages).orderBy(desc(outboundMessages.createdAt)).limit(1);
    const wamid = lastMsg?.providerMessageId || `wamid.${uuidv4()}`;
    const waid = lastMsg?.recipient || '919999999999';

    const payload: Record<string, any> = { object: 'whatsapp_business_account', entry: [{ id: 'test_account', changes: [{ value: { messaging_product: ProviderIds.WHATSAPP } }] }] };

    const timestamp = Math.floor(Date.now() / 1000).toString();

    if (type === 'DELIVERED' || type === 'READ' || type === 'FAILED') {
      const statusObj: Record<string, any> = {
        id: wamid,
        status: type.toLowerCase(),
        timestamp,
        recipient_id: waid
      };
      if (type === 'FAILED') {
         statusObj.errors = [{ title: 'Simulated failure', message: 'This is a simulated failure for testing.' }];
      }
      payload.entry[0].changes[0].value.statuses = [statusObj];
    } else if (type === 'REPLY') {
      payload.entry[0].changes[0].value.messages = [{
        from: waid,
        id: `wamid.${uuidv4()}`,
        timestamp,
        type: 'text',
        text: { body: 'This is a simulated reply!' },
        context: { id: wamid }
      }];
      payload.entry[0].changes[0].value.contacts = [{ wa_id: waid, profile: { name: 'Simulated User' } }];
    }

    const port = process.env.PORT || 3002;
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/webhooks/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return reply.send({ success: res.ok, simulatedPayload: payload });
  });
};
