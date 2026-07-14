export type DestinationType = 'webhook' | 'kafka';

export interface AuthenticationConfig {
  type: 'none' | 'basic' | 'bearer';
  username?: string;
  password?: string;
  token?: string;
}

export interface Destination {
  id: number;
  name: string;
  type: DestinationType;
  url: string;
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  headers: Record<string, string> | null;
  authentication: AuthenticationConfig | null;
  createdAt: Date;
  updatedAt: Date;
}
