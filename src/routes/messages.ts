/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { outboundMessages, inboundMessages, communicationTimeline, NewOutboundMessageRecord } from '../db/schema';
import { EventBus } from '../services/eventBus';
import { CommunicationProcessor } from '../services/communicationProcessor';
import { eq, desc, or, asc } from 'drizzle-orm';
import { MetaApiService } from '../services/metaApiService';
import { MetaMapper } from '../mappers/metaMapper';

const messageSchema = z.object({
  channel: z.string().min(1),
  recipient: z.string().min(1),
  template: z.string().min(1),
  language: z.string().optional(),
  variables: z.array(z.string()).optional(),
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

  app.get('/conversations', async (_request, reply) => {
    try {
      const outbounds = await db.select().from(outboundMessages).orderBy(desc(outboundMessages.createdAt)).limit(500);
      const inbounds = await db.select().from(inboundMessages).orderBy(desc(inboundMessages.createdAt)).limit(500);

      const map = new Map<string, any>();

      // Group outbounds
      for (const msg of outbounds) {
        const key = msg.recipient;
        if (!map.has(key)) {
          map.set(key, {
            recipient: msg.recipient,
            customerName: msg.recipient,
            channel: msg.channel,
            lastActivity: msg.createdAt,
            lastMessage: {
              id: msg.messageId,
              direction: 'OUTGOING',
              text: `Template: ${msg.template}`,
              template: msg.template,
              status: msg.status,
              timestamp: msg.createdAt,
            },
            messagesCount: 1,
            unread: false
          });
        } else {
          const conv = map.get(key);
          conv.messagesCount += 1;
          if (new Date(msg.createdAt) > new Date(conv.lastActivity)) {
            conv.lastActivity = msg.createdAt;
            conv.lastMessage = {
              id: msg.messageId,
              direction: 'OUTGOING',
              text: `Template: ${msg.template}`,
              template: msg.template,
              status: msg.status,
              timestamp: msg.createdAt,
            };
          }
        }
      }

      // Group inbounds
      for (const msg of inbounds) {
        const key = msg.waId || msg.sender;
        if (!map.has(key)) {
          map.set(key, {
            recipient: key,
            customerName: msg.sender || key,
            channel: 'whatsapp',
            lastActivity: msg.timestamp || msg.createdAt,
            lastMessage: {
              id: `in_${msg.id}`,
              direction: 'INCOMING',
              text: msg.text || `[${msg.messageType}]`,
              status: 'RECEIVED',
              timestamp: msg.timestamp || msg.createdAt,
            },
            messagesCount: 1,
            unread: true
          });
        } else {
          const conv = map.get(key);
          conv.messagesCount += 1;
          if (msg.sender && msg.sender !== key) {
            conv.customerName = msg.sender;
          }
          const msgTime = msg.timestamp || msg.createdAt;
          if (new Date(msgTime) > new Date(conv.lastActivity)) {
            conv.lastActivity = msgTime;
            conv.lastMessage = {
              id: `in_${msg.id}`,
              direction: 'INCOMING',
              text: msg.text || `[${msg.messageType}]`,
              status: 'RECEIVED',
              timestamp: msgTime,
            };
          }
        }
      }

      const conversations = Array.from(map.values()).sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      return reply.send({ success: true, conversations });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  app.get('/conversations/:recipient', async (request, reply) => {
    try {
      const { recipient } = request.params as { recipient: string };

      const outbounds = await db
        .select()
        .from(outboundMessages)
        .where(eq(outboundMessages.recipient, recipient))
        .orderBy(asc(outboundMessages.createdAt));

      const inbounds = await db
        .select()
        .from(inboundMessages)
        .where(or(eq(inboundMessages.waId, recipient), eq(inboundMessages.sender, recipient)))
        .orderBy(asc(inboundMessages.createdAt));

      const timelineEntries = await db
        .select()
        .from(communicationTimeline)
        .orderBy(asc(communicationTimeline.createdAt));

      const timelineMap = new Map<string, any[]>();
      for (const entry of timelineEntries) {
        if (!timelineMap.has(entry.messageId)) {
          timelineMap.set(entry.messageId, []);
        }
        timelineMap.get(entry.messageId)!.push(entry);
      }

      const unified: any[] = [];

      for (const out of outbounds) {
        unified.push({
          id: out.messageId,
          dbId: out.id,
          messageId: out.messageId,
          eventId: out.eventId,
          direction: 'OUTGOING',
          recipient: out.recipient,
          channel: out.channel,
          template: out.template,
          variables: out.variables,
          metadata: out.metadata,
          status: out.status,
          provider: out.provider,
          providerMessageId: out.providerMessageId,
          providerStatus: out.providerStatus,
          providerResponse: out.providerResponse,
          providerLatency: out.providerLatency,
          providerHttpStatus: out.providerHttpStatus,
          requestedBy: out.requestedBy,
          source: out.source,
          createdAt: out.createdAt,
          acceptedAt: out.acceptedAt,
          timeline: timelineMap.get(out.messageId) || [],
          timestamp: out.createdAt
        });
      }

      for (const inb of inbounds) {
        unified.push({
          id: `in_${inb.id}`,
          dbId: inb.id,
          direction: 'INCOMING',
          recipient: inb.waId || inb.sender,
          sender: inb.sender,
          waId: inb.waId,
          messageType: inb.messageType,
          text: inb.text,
          rawPayload: inb.rawPayload,
          status: 'RECEIVED',
          timestamp: inb.timestamp || inb.createdAt,
          createdAt: inb.createdAt
        });
      }

      unified.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return reply.send({ success: true, recipient, messages: unified });
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
      
      // Validation Logic
      if (body.channel === 'whatsapp') {
        const templates = await MetaApiService.getTemplates();
        const targetTemplate = templates.find(t => t.name === body.template && (body.language ? t.language === body.language : true));

        if (!targetTemplate) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid Template',
            details: `Template '${body.template}' with language '${body.language || 'any'}' not found.`
          });
        }

        if (targetTemplate.status !== 'APPROVED') {
          return reply.status(400).send({
            success: false,
            error: 'Invalid Template',
            details: `Template '${body.template}' is not APPROVED (status: ${targetTemplate.status}).`
          });
        }

        const requirements = MetaMapper.getTemplateRequirements(targetTemplate.components);
        const providedCount = body.variables ? body.variables.length : 0;
        
        app.log.info(`[${new Date().toISOString()}] VALIDATING VARIABLES for ${body.template}: Expected ${requirements.expectedVariables}, Provided ${providedCount}`);
        if (body.variables) {
          app.log.info(`[${new Date().toISOString()}] PROVIDED VARIABLES: ${JSON.stringify(body.variables)}`);
        }

        if (requirements.expectedVariables !== providedCount) {
          app.log.error(`[${new Date().toISOString()}] VALIDATION FAILED: Template expects ${requirements.expectedVariables} variables, but ${providedCount} were provided.`);
          return reply.status(400).send({
            success: false,
            error: 'Invalid Template',
            details: `Template expects ${requirements.expectedVariables} variables, but ${providedCount} were provided.`
          });
        }

        if (requirements.requiresMedia) {
          app.log.info(`[${new Date().toISOString()}] VALIDATING MEDIA: Template expects ${requirements.mediaType}`);
          if (!body.metadata || !body.metadata.mediaBase64) {
            app.log.error(`[${new Date().toISOString()}] VALIDATION FAILED: Template expects a ${requirements.mediaType}, but 'mediaBase64' was not provided.`);
            return reply.status(400).send({
              success: false,
              error: 'Invalid Template',
              details: `Template expects a ${requirements.mediaType} in the header, but 'mediaBase64' was not provided in metadata.`
            });
          }
        }
      }

      const messageId = uuidv4();
      const eventId = uuidv4();

      const mergedMetadata: any = { ...(body.metadata || {}), language: body.language };

      // Offload media to file to prevent DB and SSE CPU spikes
      if (mergedMetadata.mediaBase64) {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        
        let mimeType = 'application/octet-stream';
        let base64Data = mergedMetadata.mediaBase64 as string;
        
        if (base64Data.startsWith('data:')) {
           const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*?,(.*)$/);
           if (matches) {
             mimeType = matches[1];
             base64Data = matches[2];
           }
        }
        
        let ext = '.bin';
        if (mimeType.includes('pdf')) ext = '.pdf';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
        else if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('mp4')) ext = '.mp4';
        
        const tempPath = path.join(os.tmpdir(), `kamna_media_${messageId}${ext}`);
        await fs.writeFile(tempPath, Buffer.from(base64Data, 'base64'));
        
        mergedMetadata.mediaFilePath = tempPath;
        mergedMetadata.mediaMimeType = mimeType;
        delete mergedMetadata.mediaBase64;
      }

      const messageRecord: NewOutboundMessageRecord = {
        messageId,
        eventId,
        channel: body.channel,
        recipient: body.recipient,
        template: body.template,
        variables: body.variables || null,
        metadata: mergedMetadata,
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
        metadata: mergedMetadata,
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
        gatewayMessageId: messageId,
        providerMessageId: null,
        providerStatus: 'accepted',
        queuedAt: messageRecord.createdAt
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
