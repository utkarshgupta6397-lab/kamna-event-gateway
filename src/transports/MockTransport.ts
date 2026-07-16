import { Transport, TransportResponse } from './Transport';
import { v4 as uuidv4 } from 'uuid';

export class MockTransport implements Transport {
  async send(message: any): Promise<TransportResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      providerMessageId: `mock_wamid_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      providerStatus: 'accepted',
      providerResponse: {
        messaging_product: 'whatsapp',
        contacts: [{ input: message.recipient, wa_id: message.recipient }],
        messages: [{ id: `mock_wamid_${uuidv4().replace(/-/g, '').substring(0, 16)}` }]
      }
    };
  }
}
