import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { ProviderIds } from '../constants/providers';

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

export const outboundMessages = sqliteTable('outbound_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: text('message_id').notNull().unique(),
  eventId: text('event_id').notNull(),
  channel: text('channel').notNull(),
  recipient: text('recipient').notNull(),
  template: text('template').notNull(),
  variables: text('variables', { mode: 'json' }),
  metadata: text('metadata', { mode: 'json' }),
  requestedBy: text('requested_by').notNull(),
  source: text('source').notNull(),
  status: text('status').notNull().default('QUEUED'),
  provider: text('provider'),
  providerMessageId: text('provider_message_id'),
  providerStatus: text('provider_status'),
  providerResponse: text('provider_response', { mode: 'json' }),
  providerLatency: integer('provider_latency'),
  providerHttpStatus: integer('provider_http_status'),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type OutboundMessageRecord = typeof outboundMessages.$inferSelect;
export type NewOutboundMessageRecord = typeof outboundMessages.$inferInsert;

export const communicationTimeline = sqliteTable('communication_timeline', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: text('message_id').notNull(),
  status: text('status').notNull(),
  description: text('description').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type CommunicationTimelineRecord = typeof communicationTimeline.$inferSelect;
export type NewCommunicationTimelineRecord = typeof communicationTimeline.$inferInsert;

export const providerConfiguration = sqliteTable('provider_configuration', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull().unique(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  settingsJson: text('settings_json', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type ProviderConfigurationRecord = typeof providerConfiguration.$inferSelect;
export type NewProviderConfigurationRecord = typeof providerConfiguration.$inferInsert;

export const webhookEvents = sqliteTable('webhook_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull().default(ProviderIds.WHATSAPP),
  eventType: text('event_type'),
  webhookObject: text('webhook_object'),
  providerMessageId: text('provider_message_id'),
  rawPayload: text('raw_payload', { mode: 'json' }).notNull(),
  processed: integer('processed', { mode: 'boolean' }).notNull().default(false),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
  processingError: text('processing_error'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type WebhookEventRecord = typeof webhookEvents.$inferSelect;
export type NewWebhookEventRecord = typeof webhookEvents.$inferInsert;

export const inboundMessages = sqliteTable('inbound_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sender: text('sender').notNull(),
  waId: text('wa_id'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  messageType: text('message_type').notNull(),
  text: text('text'),
  rawPayload: text('raw_payload', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type InboundMessageRecord = typeof inboundMessages.$inferSelect;
export type NewInboundMessageRecord = typeof inboundMessages.$inferInsert;

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  lastUsedIp: text('last_used_ip'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
});

export type ApiKeyRecord = typeof apiKeys.$inferSelect;
export type NewApiKeyRecord = typeof apiKeys.$inferInsert;

export const whatsappTemplates = sqliteTable('whatsapp_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  language: text('language').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull(),
  components: text('components', { mode: 'json' }).notNull(),
  metaTemplateId: text('meta_template_id'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }).notNull(),
});

export type WhatsappTemplateRecord = typeof whatsappTemplates.$inferSelect;
export type NewWhatsappTemplateRecord = typeof whatsappTemplates.$inferInsert;

export const providerWebhookLogs = sqliteTable('provider_webhook_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(),
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
  httpMethod: text('http_method').notNull(),
  requestUrl: text('request_url').notNull(),
  headersJson: text('headers_json', { mode: 'json' }).notNull(),
  bodyJson: text('body_json', { mode: 'json' }),
  rawBody: text('raw_body'),
  ipAddress: text('ip_address'),
  signature: text('signature'),
  signatureValid: integer('signature_valid', { mode: 'boolean' }),
  signaturePresent: integer('signature_present', { mode: 'boolean' }),
  signatureAlgorithm: text('signature_algorithm'),
  validationError: text('validation_error'),
  processingStatus: text('processing_status').notNull().default('Received'),
  processingTimeMs: integer('processing_time_ms'),
  matchedCommunicationId: text('matched_communication_id'),
  matchedProviderMessageId: text('matched_provider_message_id'),
  eventType: text('event_type'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type ProviderWebhookLogRecord = typeof providerWebhookLogs.$inferSelect;
export type NewProviderWebhookLogRecord = typeof providerWebhookLogs.$inferInsert;
