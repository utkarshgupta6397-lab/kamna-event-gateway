import { Transport } from './Transport';
import { MockTransport } from './MockTransport';
import { MetaTransport } from './MetaTransport';
import { ProviderConfigurationService } from '../services/ProviderConfigurationService';

import { ProviderIds } from '../constants/providers';

export class TransportFactory {
  static async getTransport(channel: string): Promise<Transport> {
    
    // Attempt to load from database first
    if (channel === ProviderIds.WHATSAPP) {
      const config = await ProviderConfigurationService.getMetaConfiguration();
      if (config && config.enabled && config.accessToken) {
        return new MetaTransport({
          accessToken: config.accessToken,
          phoneNumberId: config.phoneNumberId,
          apiVersion: config.apiVersion,
          defaultLanguage: config.defaultLanguage
        });
      }
    }
    
    // Fallback to mock for testing if explicitly enabled
    if (process.env.USE_MOCK_TRANSPORT === 'true') {
      return new MockTransport();
    }
    
    // No more environment variable fallback for MetaTransport!
    if (channel === ProviderIds.WHATSAPP) {
       throw new Error('MetaTransport is not configured in the database. Please configure it in the UI.');
    }
    
    // Default fallback
    return new MockTransport();
  }
}
