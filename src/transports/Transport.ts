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
  send(message: any): Promise<TransportResponse>;
}
