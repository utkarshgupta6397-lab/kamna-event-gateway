import { Transport, TransportResult } from '../domain/transport';
import { DomainEvent } from '../domain/event';
import { Destination } from '../domain/destination';

export class HttpTransport implements Transport {
  async send(event: DomainEvent, destination: Destination): Promise<TransportResult> {
    const start = process.hrtime();
    let responseCode: number | null = null;
    let responseBody: string | null = null;
    let status: 'success' | 'failed' = 'failed';
    let error: string | null = null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...destination.headers,
      };

      if (destination.authentication) {
        if (destination.authentication.type === 'bearer' && destination.authentication.token) {
          headers['Authorization'] = `Bearer ${destination.authentication.token}`;
        } else if (
          destination.authentication.type === 'basic' &&
          destination.authentication.username &&
          destination.authentication.password
        ) {
          const credentials = Buffer.from(
            `${destination.authentication.username}:${destination.authentication.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
      }

      // Add standard tracing headers
      headers['X-Event-Id'] = event.eventId;
      headers['X-Event-Type'] = event.type;
      headers['X-Event-Source'] = event.source;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), destination.timeoutMs);

      const response = await fetch(destination.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      responseCode = response.status;
      responseBody = await response.text();
      
      // We assume 2xx is success
      if (responseCode >= 200 && responseCode < 300) {
        status = 'success';
      } else {
        error = `HTTP Error: ${responseCode}`;
      }

    } catch (err: unknown) {
      if (err instanceof Error) {
        error = err.name === 'AbortError' ? 'Request Timeout' : err.message;
      } else {
        error = String(err);
      }
    }

    const diff = process.hrtime(start);
    const latencyMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    return {
      status,
      responseCode,
      responseBody,
      latencyMs,
      error,
    };
  }
}
