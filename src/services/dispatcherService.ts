import { getDeliveryById, updateDelivery } from './deliveryService';
import { getEventByEventId } from './eventService';
import { getDestinationById } from './destinationService';
import { TransportRegistry } from '../domain/transport';
import { DeliveryRecord } from '../db/schema';
import { DomainEvent } from '../domain/event';
import { Destination, DestinationType, AuthenticationConfig } from '../domain/destination';
import { EventBus, EventType } from './eventBus';

export const dispatchDelivery = async (deliveryId: number): Promise<DeliveryRecord> => {
  // 1. Load Delivery
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);
  if (delivery.status === 'processing') throw new Error(`Delivery ${deliveryId} is already processing`);
  if (delivery.status === 'success') throw new Error(`Delivery ${deliveryId} already succeeded`);

  // 2. Load Event
  const eventRecord = await getEventByEventId(delivery.eventId);
  if (!eventRecord) throw new Error(`Event ${delivery.eventId} not found`);

  const domainEvent: DomainEvent = {
    eventId: eventRecord.eventId,
    source: eventRecord.source,
    type: eventRecord.type,
    payload: eventRecord.payload as Record<string, unknown> | null,
    metadata: eventRecord.metadata as import('../domain/event').EventMetadata,
    receivedAt: eventRecord.receivedAt,
  };

  // 3. Load Destination
  const destRecord = await getDestinationById(delivery.destinationId);
  if (!destRecord) throw new Error(`Destination ${delivery.destinationId} not found`);

  const destination: Destination = {
    id: destRecord.id,
    name: destRecord.name,
    type: destRecord.type as DestinationType,
    url: destRecord.url,
    enabled: destRecord.enabled,
    priority: destRecord.priority,
    timeoutMs: destRecord.timeoutMs,
    headers: destRecord.headers as Record<string, string> | null,
    authentication: destRecord.authentication as AuthenticationConfig | null,
    createdAt: destRecord.createdAt,
    updatedAt: destRecord.updatedAt,
  };

  // 4. Resolve Transport Plugin
  const transport = TransportRegistry.get(destination.type);

  // 5. Update Status to Processing
  await updateDelivery(deliveryId, {
    status: 'processing',
    startedAt: new Date(),
    attempt: delivery.attempt + 1,
  });

  EventBus.publish(EventType.DELIVERY_STARTED, { deliveryId, eventId: delivery.eventId, destinationId: delivery.destinationId });

  // 6. Execute Send
  const result = await transport.send(domainEvent, destination);

  // 7. Capture and Update Delivery
  const updated = await updateDelivery(deliveryId, {
    status: result.status,
    completedAt: new Date(),
    responseCode: result.responseCode,
    responseBody: result.responseBody,
    latencyMs: result.latencyMs,
    error: result.error,
  });

  if (result.status === 'success') {
    EventBus.publish(EventType.DELIVERY_SUCCESS, { delivery: updated });
  } else {
    EventBus.publish(EventType.DELIVERY_FAILED, { delivery: updated });
  }

  return updated;
};
