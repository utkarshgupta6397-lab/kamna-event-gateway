# Architecture

Kamna Event Gateway is designed as a high-throughput, low-latency event routing tier.

## High-Level Flow
1. **Ingress**: Events arrive via HTTP POST requests to the gateway's exposed endpoints.
2. **Validation**: The payload envelope is validated using Zod schemas. The gateway only cares about the envelope (routing keys, headers, etc.), not the inner payload.
3. **Routing**: Based on the routing keys, the gateway determines the destinations.
4. **Egress**: The event is forwarded to the designated consumers (e.g., via Webhooks).

## Authentication & Security Architecture

### Gateway Authentication vs Public Provider Webhooks
The Gateway uses a dual-tier authentication design:

1. **Gateway Standard API Routes** (`/api/v1/events`, `/api/v1/messages`, `/api/v1/deliveries`, etc.):
   - Protected via `authMiddleware` using JWT Bearer tokens or API Keys (`x-api-key`).

2. **Public Webhook Routes** (`/api/v1/webhooks/*`):
   - External webhook providers (Meta WhatsApp, Twilio, SendGrid, etc.) cannot send Gateway JWT or API Key headers.
   - All routes prefixed with `/api/v1/webhooks/` bypass standard Gateway authentication via `PUBLIC_WEBHOOK_PREFIXES`.
   - Security for webhook endpoints is enforced **within route handlers using provider-specific cryptographic signature verification**.

### Meta Signature Verification Flow (`POST /api/v1/webhooks/meta`)
- **Header**: `x-hub-signature-256` (`sha256=<hmac_sha256_hex>`)
- **Verification**: Computes `crypto.createHmac('sha256', appSecret).update(rawBody)` and performs a timing-safe buffer comparison (`crypto.timingSafeEqual`).
- **Policy**:
  - Invalid signatures return `HTTP 403 Forbidden` and log details to `provider_webhook_logs`.
  - In production (`NODE_ENV === 'production'`), Meta App Secret is mandatory.
  - In development, missing App Secret emits a warning and allows testing.

### Integration Pattern for Future Webhook Providers
To add a new webhook provider (e.g. `Twilio`, `Email`):
1. Register route under `/api/v1/webhooks/<provider>`.
2. It automatically bypasses Gateway JWT/API Key auth via `PUBLIC_WEBHOOK_PREFIXES`.
3. Implement provider signature verification (e.g. Twilio `X-Twilio-Signature`) inside the route handler.
4. Record incoming payload and signature verification result in `provider_webhook_logs`.

## Separation of Concerns
The gateway is strictly an infrastructure component. It must not import code from other business services (like an ERP). It acts as a generic pipe.

## Concurrency and Scaling
Since Node.js is single-threaded, the application relies on Fastify's highly optimized async I/O to handle thousands of concurrent connections. For horizontal scaling, the service should be run in a cluster or across multiple containers/pods managed by an orchestrator like Kubernetes.
