import { db } from '../db';
import { destinations, NewDestinationRecord, DestinationRecord } from '../db/schema';
import { eq } from 'drizzle-orm';
import { DestinationType, AuthenticationConfig } from '../domain/destination';

export const getDestinations = async () => {
  return await db.query.destinations.findMany({
    orderBy: (dest, { desc }) => [desc(dest.priority)],
  });
};

export const getEnabledDestinations = async () => {
  return await db.query.destinations.findMany({
    where: eq(destinations.enabled, true),
    orderBy: (dest, { desc }) => [desc(dest.priority)],
  });
};

export const getDestinationById = async (id: number) => {
  return await db.query.destinations.findFirst({
    where: eq(destinations.id, id),
  });
};

export const createDestination = async (data: {
  name: string;
  type?: DestinationType | undefined;
  url: string;
  enabled?: boolean | undefined;
  priority?: number | undefined;
  timeoutMs?: number | undefined;
  headers?: Record<string, string> | null | undefined;
  authentication?: AuthenticationConfig | null | undefined;
}) => {
  const now = new Date();
  const newDest: NewDestinationRecord = {
    name: data.name,
    type: data.type || 'webhook',
    url: data.url,
    enabled: data.enabled ?? true,
    priority: data.priority ?? 0,
    timeoutMs: data.timeoutMs ?? 5000,
    headers: data.headers ?? null,
    authentication: data.authentication ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.insert(destinations).values(newDest).returning();
  return result[0];
};

type PartialWithUndefined<T> = {
  [P in keyof T]?: T[P] | undefined;
};

export const updateDestination = async (
  id: number,
  data: PartialWithUndefined<Omit<DestinationRecord, 'id' | 'createdAt' | 'updatedAt'>>
) => {
  const result = await db
    .update(destinations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(destinations.id, id))
    .returning();
  
  return result[0];
};

export const deleteDestination = async (id: number) => {
  const result = await db.delete(destinations).where(eq(destinations.id, id)).returning();
  return result[0];
};
