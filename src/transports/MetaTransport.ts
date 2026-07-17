/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transport, TransportResponse } from './Transport';
import { MetaApiService } from '../services/metaApiService';
import { MetaMapper } from '../mappers/metaMapper';

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

  async send(message: Record<string, any>): Promise<TransportResponse> {
    const accessToken = this.config?.accessToken;
    const phoneNumberId = this.config?.phoneNumberId;
    const apiVersion = this.config?.apiVersion || 'v19.0';
    const defaultLanguage = this.config?.defaultLanguage || 'en';

    if (!accessToken || !phoneNumberId) {
      throw new Error('META_ACCESS_TOKEN and META_PHONE_NUMBER_ID are required and must be provided via config.');
    }

    try {
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
      
      const templates = await MetaApiService.getTemplates(true);
      const targetLanguage = message.metadata?.language || defaultLanguage;
      
      // If the ERP explicitly asked for a language, match it. If not, match name and use its language.
      const targetTemplate = templates.find(t => t.name === message.template && (message.metadata?.language ? t.language === targetLanguage : true));

      if (!targetTemplate) {
        throw new Error(`Template '${message.template}' not found during dispatch.`);
      }

      const templatePayload = MetaMapper.buildMetaTemplatePayload(
        message.template,
        targetTemplate.language,
        (message.variables as string[]) || [],
        targetTemplate
      );

      const payload = {
        messaging_product: 'whatsapp',
        to: message.recipient,
        type: 'template',
        template: templatePayload
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

    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown HTTP or network error',
      };
    }
  }
}
