# Roadmap

The Kamna Event Gateway is currently in its scaffolding phase. The future roadmap includes:

## Phase 1: Core Routing
- Define the standard event envelope schema.
- Implement static routing tables.
- Build basic Webhook forwarding.

## Phase 2: Reliability
- Implement a Dead Letter Queue (DLQ) for failed events.
- Build automatic retry mechanisms with exponential backoff.
- Provide a replay API for recovering lost events.

## Phase 3: Observability and Management
- Export Prometheus metrics.
- Provide a management UI or API for dynamic route configuration.
- Implement rate limiting per publisher/consumer.
