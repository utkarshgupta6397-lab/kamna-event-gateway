import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { outboundMessages, communicationTimeline, NewOutboundMessageRecord } from '../db/schema';
import { EventBus } from '../services/eventBus';
import { CommunicationProcessor } from '../services/communicationProcessor';
import { eq, desc } from 'drizzle-orm';

const messageSchema = z.object({
  channel: z.string().min(1),
  recipient: z.string().min(1),
  template: z.string().min(1),
  variables: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  requestedBy: z.string().min(1),
  source: z.string().min(1),
});

export const messageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  
  app.get('/', async (_request, reply) => {
    try {
      // Fetch newest messages first
      const messages = await db
        .select()
        .from(outboundMessages)
        .orderBy(desc(outboundMessages.createdAt))
        .limit(100); // hard limit for safety, UI handles simple pagination in-memory for now
      return reply.send({ success: true, messages });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  app.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const [message] = await db
        .select()
        .from(outboundMessages)
        .where(eq(outboundMessages.messageId, id))
        .limit(1);

      if (!message) {
        return reply.status(404).send({ success: false, error: 'Message not found' });
      }

      const timeline = await db
        .select()
        .from(communicationTimeline)
        .where(eq(communicationTimeline.messageId, id))
        .orderBy(communicationTimeline.createdAt);

      return reply.send({ success: true, message: { ...message, timeline } });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  app.post('/send', async (request, reply) => {
    try {
      const body = messageSchema.parse(request.body);
      const messageId = uuidv4();
      const eventId = uuidv4();

      const messageRecord: NewOutboundMessageRecord = {
        messageId,
        eventId,
        channel: body.channel,
        recipient: body.recipient,
        template: body.template,
        variables: body.variables || null,
        metadata: body.metadata || null,
        requestedBy: body.requestedBy,
        source: body.source,
        status: 'QUEUED',
        createdAt: new Date(),
      };

      await db.insert(outboundMessages).values(messageRecord);

      const eventPayload = {
        eventId,
        messageId,
        channel: body.channel,
        recipient: body.recipient,
        template: body.template,
        variables: body.variables,
        metadata: body.metadata,
        requestedBy: body.requestedBy,
        source: body.source,
        status: 'QUEUED',
      };

      EventBus.publish('COMMUNICATION_OUTBOUND_REQUESTED' as any, {
        type: 'communication.outbound.requested',
        event: {
          eventId,
          source: body.source,
          type: 'communication.outbound.requested',
          payload: eventPayload,
          receivedAt: new Date(),
          status: 'QUEUED',
        },
      });

      // Start asynchronous processing engine
      CommunicationProcessor.process(messageId, eventId, body.source);

      return reply.send({
        success: true,
        messageId,
        eventId,
        status: 'QUEUED',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: error.errors,
        });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
};
