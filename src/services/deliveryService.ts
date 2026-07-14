import { db } from '../db';
import { deliveries, NewDeliveryRecord, DeliveryRecord } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { Delivery } from '../domain/delivery';

export const createDeliveries = async (domainDeliveries: Delivery[]) => {
  if (domainDeliveries.length === 0) return [];
  
  const records: NewDeliveryRecord[] = domainDeliveries.map((d) => ({
    eventId: d.eventId,
    destinationId: d.destinationId,
    status: d.status,
    attempt: d.attempt,
    queuedAt: d.queuedAt,
    startedAt: d.startedAt,
    completedAt: d.completedAt,
    responseCode: d.responseCode,
    latencyMs: d.latencyMs,
    error: d.error,
  }));

  const result = await db.insert(deliveries).values(records).returning();
  return result;
};

export const updateDelivery = async (
  id: number,
  data: Partial<Omit<DeliveryRecord, 'id' | 'queuedAt'>>
) => {
  const result = await db
    .update(deliveries)
    .set(data)
    .where(eq(deliveries.id, id))
    .returning();
  
  return result[0];
};

export const getDeliveries = async (limit: number = 100) => {
  return await db.query.deliveries.findMany({
    orderBy: [desc(deliveries.queuedAt)],
    limit,
  });
};

export const getDeliveryById = async (id: number) => {
  return await db.query.deliveries.findFirst({
    where: eq(deliveries.id, id),
  });
};

export const getDeliveriesByEventId = async (eventId: string) => {
  return await db.query.deliveries.findMany({
    where: eq(deliveries.eventId, eventId),
    orderBy: [desc(deliveries.queuedAt)],
  });
};
