import { Transport, TransportResponse } from './Transport';

export interface MetaTransportConfig {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion?: string;
  defaultLanguage?: string;
}

export class MetaTransport implements Transport {
  private config: MetaTransportConfig | undefined;

  constructor(config?: MetaTransportConfig) {
    this.config = config;
  }

  async send(message: any): Promise<TransportResponse> {
    const accessToken = this.config?.accessToken || process.env.META_ACCESS_TOKEN;
    const phoneNumberId = this.config?.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
    const apiVersion = this.config?.apiVersion || process.env.META_API_VERSION || 'v19.0';
    const defaultLanguage = this.config?.defaultLanguage || process.env.META_DEFAULT_LANGUAGE || 'en';

    if (!accessToken || !phoneNumberId) {
      throw new Error('META_ACCESS_TOKEN and META_PHONE_NUMBER_ID are required in the environment for MetaTransport.');
    }

    try {
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: message.recipient,
        type: 'template',
        template: {
          name: message.template,
          language: { code: defaultLanguage }, 
          components: [] // Empty components for MVP test template
        }
      };

      const startTime = performance.now();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      const httpStatus = response.status;
      const json = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: json.error?.message || 'Meta API Error',
          providerResponse: json,
          latencyMs,
          httpStatus
        };
      }

      return {
        success: true,
        providerMessageId: json.messages?.[0]?.id,
        providerStatus: 'accepted',
        providerResponse: json,
        latencyMs,
        httpStatus
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
