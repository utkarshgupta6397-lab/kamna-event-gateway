import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestId: text('request_id').notNull(),
  method: text('method').notNull(),
  path: text('path').notNull(),
  headers: text('headers', { mode: 'json' }).notNull(),
  query: text('query', { mode: 'json' }).notNull(),
  body: text('body', { mode: 'json' }),
  sourceIp: text('source_ip'),
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
  processingTimeMs: integer('processing_time_ms'),
  status: text('status').notNull().default('received'),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
