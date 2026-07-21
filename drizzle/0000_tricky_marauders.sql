CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	`last_used_ip` text,
	`enabled` integer DEFAULT true NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `communication_timeline` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`status` text NOT NULL,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`destination_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`queued_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`response_code` integer,
	`response_body` text,
	`latency_ms` integer,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `destinations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'webhook' NOT NULL,
	`url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`timeout_ms` integer DEFAULT 5000 NOT NULL,
	`headers` text,
	`authentication` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`source` text NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`metadata` text NOT NULL,
	`received_at` integer NOT NULL,
	`processing_time_ms` integer,
	`status` text DEFAULT 'received' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbound_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender` text NOT NULL,
	`wa_id` text,
	`timestamp` integer NOT NULL,
	`message_type` text NOT NULL,
	`text` text,
	`raw_payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbound_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`event_id` text NOT NULL,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`template` text NOT NULL,
	`variables` text,
	`metadata` text,
	`requested_by` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`provider` text,
	`provider_message_id` text,
	`provider_status` text,
	`provider_response` text,
	`provider_latency` integer,
	`provider_http_status` integer,
	`sent_at` integer,
	`accepted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbound_messages_message_id_unique` ON `outbound_messages` (`message_id`);--> statement-breakpoint
CREATE TABLE `provider_configuration` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`settings_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_configuration_provider_unique` ON `provider_configuration` (`provider`);--> statement-breakpoint
CREATE TABLE `provider_webhook_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`received_at` integer NOT NULL,
	`http_method` text NOT NULL,
	`request_url` text NOT NULL,
	`headers_json` text NOT NULL,
	`body_json` text,
	`raw_body` text,
	`ip_address` text,
	`signature` text,
	`signature_valid` integer,
	`processing_status` text DEFAULT 'Received' NOT NULL,
	`processing_time_ms` integer,
	`matched_communication_id` text,
	`matched_provider_message_id` text,
	`event_type` text,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text DEFAULT 'meta' NOT NULL,
	`event_type` text,
	`webhook_object` text,
	`provider_message_id` text,
	`raw_payload` text NOT NULL,
	`processed` integer DEFAULT false NOT NULL,
	`processed_at` integer,
	`received_at` integer NOT NULL,
	`processing_error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whatsapp_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`language` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`components` text NOT NULL,
	`meta_template_id` text,
	`last_synced_at` integer NOT NULL
);
