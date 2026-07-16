import { db } from '../db';
import { events, NewEventRecord } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { DomainEvent } from '../domain/event';
import { EventBus, EventType } from './eventBus';

export const persistEvent = async (domainEvent: DomainEvent, processingTimeMs?: number) => {
  const eventData: NewEventRecord = {
    eventId: domainEvent.eventId,
    source: domainEvent.source,
    type: domainEvent.type,
    payload: domainEvent.payload,
    metadata: domainEvent.metadata,
    receivedAt: domainEvent.receivedAt,
    status: 'received',
    processingTimeMs,
  };

  const result = await db.insert(events).values(eventData).returning();
  
  EventBus.publish(EventType.EVENT_RECEIVED, { event: result[0] });
  
  return result[0];
};

export const getEvents = async (limit: number = 100) => {
  return await db.query.events.findMany({
    orderBy: [desc(events.receivedAt)],
    limit,
  });
};

export const getEventById = async (id: number) => {
  const result = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  return result;
};

export const getEventByEventId = async (eventId: string) => {
  const result = await db.query.events.findFirst({
    where: eq(events.eventId, eventId),
  });
  return result;
};
