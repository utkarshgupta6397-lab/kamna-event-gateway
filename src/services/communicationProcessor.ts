/* eslint-disable no-console */
import { db } from '../db';
import { outboundMessages, communicationTimeline } from '../db/schema';
import { EventBus, EventType } from './eventBus';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { TransportFactory } from '../transports/TransportFactory';

export class CommunicationProcessor {
  /**
   * Processes an outbound communication asynchronously.
   * Steps: QUEUED -> VALIDATED -> PROCESSING -> SENT
   */
  static async process(messageId: string, eventId: string, source: string) {
    try {
      // 1. Initial Timeline Entry (Queued) is assumed to be handled by the router, 
      // but let's record it if needed, or just proceed to Validate.
      await this.recordTransition(messageId, 'QUEUED', 'Communication Requested');

      // Simulate network delay / async processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Validate
      await this.updateStatus(messageId, 'VALIDATED', 'Validated', eventId, source, EventType.COMMUNICATION_VALIDATED);

      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Processing (Preparing payload for Meta, etc.)
      await this.updateStatus(messageId, 'PROCESSING', 'Processing', eventId, source, EventType.COMMUNICATION_PROCESSING);

      await new Promise(resolve => setTimeout(resolve, 500));

      // 4. Sending (Handing off to Transport)
      await this.updateStatus(messageId, 'SENDING', 'Sending to Provider', eventId, source, EventType.COMMUNICATION_SENDING);

      // 5. Fetch message details to pass to transport
      const [message] = await db.select().from(outboundMessages).where(eq(outboundMessages.messageId, messageId));
      if (!message) throw new Error('Message not found');

      // 6. Invoke Transport
      const transport = await TransportFactory.getTransport(message.channel);
      const response = await transport.send(message);

      if (response.success) {
        // Update DB with provider info
        await db.update(outboundMessages)
          .set({ 
            status: 'META_ACCEPTED',
            provider: 'Meta Cloud API',
            providerMessageId: response.providerMessageId,
            providerStatus: response.providerStatus,
            providerResponse: response.providerResponse,
            providerLatency: response.latencyMs,
            providerHttpStatus: response.httpStatus,
            sentAt: new Date(),
            acceptedAt: new Date()
          })
          .where(eq(outboundMessages.messageId, messageId));

        await this.recordTransition(messageId, 'META_ACCEPTED', 'Accepted by Meta');
        
        // Publish Event
        const newEventId = uuidv4();
        EventBus.publish(EventType.COMMUNICATION_PROVIDER_ACCEPTED, {
          type: EventType.COMMUNICATION_PROVIDER_ACCEPTED,
          event: {
            eventId: newEventId,
            source: source,
            type: EventType.COMMUNICATION_PROVIDER_ACCEPTED,
            payload: {
              messageId,
              eventId,
              status: 'META_ACCEPTED',
              providerResponse: response.providerResponse
            },
            receivedAt: new Date(),
            status: 'META_ACCEPTED',
          },
        });
      } else {
        await this.updateStatus(messageId, 'FAILED', `Failed: ${response.error}`, eventId, source, EventType.SYSTEM_ERROR);
        await db.update(outboundMessages)
          .set({ 
            providerResponse: response.providerResponse,
            providerLatency: response.latencyMs,
            providerHttpStatus: response.httpStatus,
          })
          .where(eq(outboundMessages.messageId, messageId));
      }

    } catch (error: unknown) {
      console.error(`Error processing communication ${messageId}:`, error);
      try {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        await this.updateStatus(messageId, 'FAILED', `System Error: ${errorMessage}`, eventId, source, EventType.SYSTEM_ERROR);
      } catch (updateError) {
        console.error(`Failed to update status to FAILED for ${messageId}`, updateError);
      }
    }
  }

  private static async recordTransition(messageId: string, status: string, description: string) {
    await db.insert(communicationTimeline).values({
      messageId,
      status,
      description,
      createdAt: new Date(),
    });
  }

  private static async updateStatus(
    messageId: string, 
    status: string, 
    description: string, 
    eventId: string, 
    source: string,
    eventType: EventType
  ) {
    // 1. Update main record
    await db.update(outboundMessages)
      .set({ status })
      .where(eq(outboundMessages.messageId, messageId));

    // 2. Record in timeline
    await this.recordTransition(messageId, status, description);

    // 3. Publish event for SSE broadcast
    try {
      const newEventId = uuidv4();
      EventBus.publish(eventType, {
        type: eventType,
        event: {
          eventId: newEventId,
          source: source,
          type: eventType,
          payload: {
            messageId,
            eventId, // The original request event ID
            status,
          },
          receivedAt: new Date(),
          status: status,
        },
      });
    } catch (sseError) {
      console.warn(`Failed to publish SSE event for ${messageId}`, sseError);
    }
  }

  /**
   * Updates communication status from an external webhook.
   */
  static async updateStatusFromWebhook(
    providerMessageId: string,
    newStatus: string,
    providerPayload: unknown,
    timestamp: Date,
    errorDetails?: string
  ) {
    const [message] = await db.select().from(outboundMessages).where(eq(outboundMessages.providerMessageId, providerMessageId));
    if (!message) return false;

    const currentStatus = message.status;
    const terminalStates = ['FAILED', 'READ', 'REPLIED'];
    
    // Prevent backward transitions or overriding terminal states (except READ -> REPLIED)
    if (terminalStates.includes(currentStatus) && currentStatus !== 'READ' && newStatus !== 'REPLIED') {
      return true; // Ignore but acknowledge match
    }
    if (currentStatus === 'READ' && newStatus !== 'REPLIED' && newStatus !== 'READ') {
       return true;
    }
    
    const descriptionMap: Record<string, string> = {
      'SENT': 'Sent',
      'DELIVERED': 'Delivered',
      'READ': 'Read',
      'REPLIED': 'Customer Replied',
      'FAILED': errorDetails ? `Failed: ${errorDetails}` : 'Failed',
    };
    
    const description = descriptionMap[newStatus] || newStatus;

    // 1. Update main record
    await db.update(outboundMessages)
      .set({ status: newStatus, providerResponse: providerPayload || message.providerResponse })
      .where(eq(outboundMessages.messageId, message.messageId));

    // 2. Record in timeline
    await this.recordTransition(message.messageId, newStatus, description);

    // 3. Publish specific SSE broadcast
    EventBus.publish(EventType.COMMUNICATION_STATUS_CHANGED, {
      type: EventType.COMMUNICATION_STATUS_CHANGED,
      event: {
        eventId: uuidv4(),
        type: EventType.COMMUNICATION_STATUS_CHANGED,
        payload: {
          messageId: message.messageId,
          providerMessageId,
          previousStatus: currentStatus,
          newStatus,
          timestamp,
          provider: 'meta',
          providerPayload
        },
        receivedAt: new Date(),
        status: newStatus,
      },
    });
    
    return true;
  }

  static async handleInboundReply(waId: string) {
    const [latestMessage] = await db.select()
      .from(outboundMessages)
      .where(eq(outboundMessages.recipient, waId))
      .orderBy(desc(outboundMessages.createdAt))
      .limit(1);
      
    if (latestMessage && latestMessage.providerMessageId) {
       await this.updateStatusFromWebhook(latestMessage.providerMessageId, 'REPLIED', null, new Date());
    }
  }
}
