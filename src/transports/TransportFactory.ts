import { Transport } from './Transport';
import { MockTransport } from './MockTransport';
import { MetaTransport } from './MetaTransport';

export class TransportFactory {
  static getTransport(channel: string): Transport {
    // For local dev, we could route based on channel or env vars.
    // If the user wants to test Meta but has no real credentials, the MetaTransport will fallback gracefully.
    
    // In the future, this factory will decide based on destination configuration.
    
    if (process.env.USE_MOCK_TRANSPORT === 'true') {
      return new MockTransport();
    }
    
    if (channel === 'whatsapp') {
      return new MetaTransport();
    }
    
    // Default fallback
    return new MockTransport();
  }
}
