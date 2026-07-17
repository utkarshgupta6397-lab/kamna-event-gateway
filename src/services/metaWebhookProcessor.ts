/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db';
import { webhookEvents, inboundMessages } from '../db/schema';
import { eq } from 'drizzle-orm';
import { CommunicationProcessor } from './communicationProcessor';
import { EventBus, EventType } from './eventBus';
import { v4 as uuidv4 } from 'uuid';

export class MetaWebhookProcessor {
  static async processWebhook(webhookId: number) {
    const [webhook] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, webhookId));
    if (!webhook || webhook.processed) return;

    try {
      const payload: any = webhook.rawPayload;
      let matched = false;

      if (payload.object === 'whatsapp_business_account') {
        for (const entry of payload.entry || []) {
          for (const change of entry.changes || []) {
            if (change.value.statuses) {
              for (const status of change.value.statuses) {
                matched = await this.handleStatus(status) || matched;
              }
            }
            if (change.value.messages) {
              for (const message of change.value.messages) {
                await this.handleMessage(message, change.value.contacts, payload);
                matched = true;
              }
            }
          }
        }
      }

      await db.update(webhookEvents)
        .set({
          processed: true,
          processedAt: new Date(),
          processingError: matched ? null : 'Unmatched',
        })
        .where(eq(webhookEvents.id, webhookId));

    } catch (error: any) {
      await db.update(webhookEvents)
        .set({
          processingError: error.message || 'Unknown processing error',
          retryCount: webhook.retryCount + 1
        })
        .where(eq(webhookEvents.id, webhookId));
    }
  }

  private static async handleStatus(statusObj: any) {
    const providerMessageId = statusObj.id;
    const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
    const timestamp = new Date(parseInt(statusObj.timestamp) * 1000);
    
    let newStatus = '';
    let errorDetails = '';

    switch (status) {
      case 'sent': newStatus = 'SENT'; break;
      case 'delivered': newStatus = 'DELIVERED'; break;
      case 'read': newStatus = 'READ'; break;
      case 'failed':
        newStatus = 'FAILED';
        errorDetails = statusObj.errors?.[0]?.title || statusObj.errors?.[0]?.message || 'Unknown provider error';
        break;
      default: return false; // Unhandled status (warning, deleted)
    }

    return await CommunicationProcessor.updateStatusFromWebhook(
      providerMessageId,
      newStatus,
      statusObj,
      timestamp,
      errorDetails
    );
  }

  private static async handleMessage(messageObj: any, contacts: any[], rawPayload: any) {
    const senderWaId = messageObj.from;
    let senderName = senderWaId;
    
    if (contacts && contacts.length > 0) {
      const contact = contacts.find((c: any) => c.wa_id === senderWaId);
      if (contact && contact.profile && contact.profile.name) {
        senderName = contact.profile.name;
      }
    }

    const timestamp = new Date(parseInt(messageObj.timestamp) * 1000);
    const messageType = messageObj.type;
    const text = messageObj.text?.body || '';

    // 1. Persist to inboundMessages
    await db.insert(inboundMessages).values({
      sender: senderName,
      waId: senderWaId,
      timestamp,
      messageType,
      text,
      rawPayload,
      createdAt: new Date()
    });

    // 2. Try to update matched outbound communication to REPLIED
    const repliedToProviderId = messageObj.context?.id;
    if (repliedToProviderId) {
      await CommunicationProcessor.updateStatusFromWebhook(repliedToProviderId, 'REPLIED', messageObj, timestamp);
    } else {
      await CommunicationProcessor.handleInboundReply(senderWaId);
    }

    // 3. Emit Event
    EventBus.publish(EventType.COMMUNICATION_INBOUND_RECEIVED, {
      type: EventType.COMMUNICATION_INBOUND_RECEIVED,
      event: {
        eventId: uuidv4(),
        type: EventType.COMMUNICATION_INBOUND_RECEIVED,
        payload: {
          senderName,
          waId: senderWaId,
          text,
          messageType,
          timestamp,
        },
        receivedAt: new Date(),
        status: 'RECEIVED'
      }
    });
  }
}
