ALTER TABLE `provider_webhook_logs` ADD `signature_present` integer;--> statement-breakpoint
ALTER TABLE `provider_webhook_logs` ADD `signature_algorithm` text;--> statement-breakpoint
ALTER TABLE `provider_webhook_logs` ADD `validation_error` text;