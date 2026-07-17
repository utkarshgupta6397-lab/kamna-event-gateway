/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TransportResponse {
  success: boolean;
  providerMessageId?: string;
  providerStatus?: string;
  providerResponse?: any;
  latencyMs?: number;
  httpStatus?: number;
  error?: string;
}

export interface Transport {
  send(message: Record<string, any>): Promise<TransportResponse>;
}
