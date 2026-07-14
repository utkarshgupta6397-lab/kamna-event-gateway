import { DomainEvent } from './event';
import { Destination } from './destination';

export interface TransportResult {
  status: 'success' | 'failed';
  responseCode: number | null;
  responseBody: string | null;
  latencyMs: number | null;
  error: string | null;
}

export interface Transport {
  send(event: DomainEvent, destination: Destination): Promise<TransportResult>;
}

export class TransportRegistry {
  private static transports = new Map<string, Transport>();

  static register(destinationType: string, transport: Transport): void {
    this.transports.set(destinationType, transport);
  }

  static get(destinationType: string): Transport {
    const transport = this.transports.get(destinationType);
    if (!transport) {
      throw new Error(`No transport registered for destination type: ${destinationType}`);
    }
    return transport;
  }
}
