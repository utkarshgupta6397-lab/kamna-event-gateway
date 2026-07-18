/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProviderConfigurationService } from './ProviderConfigurationService';
import { db } from '../db';
import { whatsappTemplates } from '../db/schema';

export class MetaApiService {
  
  static async syncTemplates(): Promise<any[]> {
    const config = await ProviderConfigurationService.getMetaConfiguration();
    if (!config || !config.accessToken || !config.businessAccountId) {
      throw new Error('Meta provider is not configured properly.');
    }

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.businessAccountId}/message_templates?limit=1000`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meta API error: ${response.status} ${errorBody}`);
    }

    const json = await response.json();
    const templates = json.data || [];
    
    // Clear old templates and insert new
    await db.delete(whatsappTemplates);
    
    if (templates.length > 0) {
      const records = templates.map((t: any) => ({
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        components: t.components || [],
        metaTemplateId: t.id,
        lastSyncedAt: new Date()
      }));
      
      await db.insert(whatsappTemplates).values(records);
    }
    
    return templates;
  }

  static async getTemplates(): Promise<any[]> {
    const templates = await db.select().from(whatsappTemplates);
    return templates;
  }

  static async uploadMedia(filePathOrBuffer: string | Buffer, mimeType: string): Promise<string> {
    const config = await ProviderConfigurationService.getMetaConfiguration();
    if (!config || !config.accessToken || !config.phoneNumberId) {
      throw new Error('Meta provider is not configured properly (missing phone number ID).');
    }

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/media`;
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    
    let buffer: Buffer;
    let filename = 'media';
    
    if (typeof filePathOrBuffer === 'string') {
      const fs = await import('fs/promises');
      const path = await import('path');
      buffer = await fs.readFile(filePathOrBuffer);
      filename = path.basename(filePathOrBuffer);
    } else {
      buffer = filePathOrBuffer;
      filename = mimeType === 'image/png' ? 'test_image.png' : 'media';
    }

    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('file', blob, filename);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meta API Media Upload error: ${response.status} ${errorBody}`);
    }

    const json = await response.json();
    return json.id;
  }
}
