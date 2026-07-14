# Architecture

Kamna Event Gateway is designed as a high-throughput, low-latency event routing tier.

## High-Level Flow
1. **Ingress**: Events arrive via HTTP POST requests to the gateway's exposed endpoints.
2. **Validation**: The payload envelope is validated using Zod schemas. The gateway only cares about the envelope (routing keys, headers, etc.), not the inner payload.
3. **Routing**: Based on the routing keys, the gateway determines the destinations.
4. **Egress**: The event is forwarded to the designated consumers (e.g., via Webhooks).

## Separation of Concerns
The gateway is strictly an infrastructure component. It must not import code from other business services (like an ERP). It acts as a generic pipe.

## Concurrency and Scaling
Since Node.js is single-threaded, the application relies on Fastify's highly optimized async I/O to handle thousands of concurrent connections. For horizontal scaling, the service should be run in a cluster or across multiple containers/pods managed by an orchestrator like Kubernetes.
