import { Transport } from './Transport';
import { MockTransport } from './MockTransport';
import { MetaTransport } from './MetaTransport';
import { db } from '../db';
import { providerConfiguration } from '../db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../security/encryption';

export class TransportFactory {
  static async getTransport(channel: string): Promise<Transport> {
    
    // Attempt to load from database first
    const [config] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, channel));
    
    if (config && config.enabled && config.settingsJson) {
      const settings = config.settingsJson as any;
      if (channel === 'whatsapp') {
        let accessToken = '';
        try {
          accessToken = decrypt(settings.encryptedAccessToken);
        } catch (e) {
          console.error('Failed to decrypt access token for MetaTransport from DB');
        }
        
        return new MetaTransport({
          accessToken,
          phoneNumberId: settings.phoneNumberId,
          apiVersion: settings.apiVersion,
          defaultLanguage: settings.defaultLanguage
        });
      }
    }
    
    // Fallback to env / mock
    if (process.env.USE_MOCK_TRANSPORT === 'true') {
      return new MockTransport();
    }
    
    if (channel === 'whatsapp') {
      return new MetaTransport(); // will read from process.env internally
    }
    
    // Default fallback
    return new MockTransport();
  }
}
