import { db } from '../db';
import { events, NewEvent } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export const createEvent = async (eventData: NewEvent) => {
  const result = await db.insert(events).values(eventData).returning();
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
