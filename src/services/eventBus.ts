/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';

class InternalEventBus extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners since we might have multiple SSE clients
    this.setMaxListeners(100);
  }

  publish(eventName: string, payload: any) {
    this.emit(eventName, payload);
    // Also emit a catch-all event for SSE broadcast
    this.emit('*', { type: eventName, ...payload });
  }

  subscribe(eventName: string, listener: (...args: any[]) => void) {
    this.on(eventName, listener);
  }

  unsubscribe(eventName: string, listener: (...args: any[]) => void) {
    this.off(eventName, listener);
  }
}

export const EventBus = new InternalEventBus();

// Strongly typed event names
export enum EventType {
  EVENT_RECEIVED = 'EVENT_RECEIVED',
  EVENT_PROCESSING_STARTED = 'EVENT_PROCESSING_STARTED',
  EVENT_COMPLETED = 'EVENT_COMPLETED',
  DELIVERY_STARTED = 'DELIVERY_STARTED',
  DELIVERY_SUCCESS = 'DELIVERY_SUCCESS',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  COMMUNICATION_OUTBOUND_REQUESTED = 'communication.outbound.requested',
  COMMUNICATION_VALIDATED = 'communication.validated',
  COMMUNICATION_PROCESSING = 'communication.processing',
  COMMUNICATION_SENDING = 'communication.sending',
  COMMUNICATION_PROVIDER_ACCEPTED = 'communication.provider.accepted',
}
