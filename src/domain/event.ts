import { FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export interface EventMetadata {
  sourceIp?: string;
  headers?: Record<string, string | string[] | undefined>;
  path?: string;
  method?: string;
  query?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DomainEvent {
  eventId: string;
  source: string;
  type: string;
  payload: Record<string, unknown> | null;
  metadata: EventMetadata;
  receivedAt: Date;
}

export class EventFactory {
  static create(
    source: string,
    type: string,
    payload: Record<string, unknown> | null,
    metadata: EventMetadata = {}
  ): DomainEvent {
    return {
      eventId: uuidv4(),
      source,
      type,
      payload,
      metadata,
      receivedAt: new Date(),
    };
  }
}

export interface EventNormalizer<T> {
  normalize(input: T): DomainEvent;
}

export class HttpEventNormalizer implements EventNormalizer<FastifyRequest> {
  normalize(request: FastifyRequest): DomainEvent {
    const metadata: EventMetadata = {
      sourceIp: request.ip,
      headers: request.headers,
      path: request.url,
      method: request.method,
      query: request.query as Record<string, unknown>,
    };

    const payload = request.body ? (request.body as Record<string, unknown>) : null;

    return EventFactory.create('http', 'http.request', payload, metadata);
  }
}
