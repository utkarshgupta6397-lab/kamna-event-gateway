import { Destination } from './destination';
import { DomainEvent } from './event';

export type DeliveryStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface Delivery {
  eventId: string;
  destinationId: number;
  status: DeliveryStatus;
  attempt: number;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  responseCode: number | null;
  responseBody: string | null;
  latencyMs: number | null;
  error: string | null;
}

export class DeliveryPlanner {
  static planDeliveries(event: DomainEvent, destinations: Destination[]): Delivery[] {
    return destinations.map((destination) => ({
      eventId: event.eventId,
      destinationId: destination.id,
      status: 'pending',
      attempt: 0,
      queuedAt: new Date(),
      startedAt: null,
      completedAt: null,
      responseCode: null,
      responseBody: null,
      latencyMs: null,
      error: null,
    }));
  }
}
