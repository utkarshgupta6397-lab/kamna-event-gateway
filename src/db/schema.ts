import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: text('event_id').notNull(),
  source: text('source').notNull(),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }),
  metadata: text('metadata', { mode: 'json' }).notNull(),
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
  processingTimeMs: integer('processing_time_ms'),
  status: text('status').notNull().default('received'),
});

export type EventRecord = typeof events.$inferSelect;
export type NewEventRecord = typeof events.$inferInsert;

export const destinations = sqliteTable('destinations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull().default('webhook'),
  url: text('url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0),
  timeoutMs: integer('timeout_ms').notNull().default(5000),
  headers: text('headers', { mode: 'json' }),
  authentication: text('authentication', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type DestinationRecord = typeof destinations.$inferSelect;
export type NewDestinationRecord = typeof destinations.$inferInsert;

export const deliveries = sqliteTable('deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: text('event_id').notNull(),
  destinationId: integer('destination_id').notNull(),
  status: text('status').notNull().default('pending'),
  attempt: integer('attempt').notNull().default(0),
  queuedAt: integer('queued_at', { mode: 'timestamp' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  responseCode: integer('response_code'),
  responseBody: text('response_body'),
  latencyMs: integer('latency_ms'),
  error: text('error'),
});

export type DeliveryRecord = typeof deliveries.$inferSelect;
export type NewDeliveryRecord = typeof deliveries.$inferInsert;
