/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProviderConfigurationService } from './ProviderConfigurationService';

interface TemplateCache {
  data: any[];
  timestamp: number;
}

export class MetaApiService {
  private static templateCache: TemplateCache | null = null;
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static async getTemplates(useCache = true): Promise<any[]> {
    if (useCache && this.templateCache) {
      if (Date.now() - this.templateCache.timestamp < this.CACHE_TTL) {
        return this.templateCache.data;
      }
    }

    const config = await ProviderConfigurationService.getMetaConfiguration();
    if (!config || !config.accessToken || !config.businessAccountId) {
      // If no config, return cached or throw
      if (useCache && this.templateCache) return this.templateCache.data;
      throw new Error('Meta provider is not configured properly.');
    }

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.businessAccountId}/message_templates?limit=1000`;
    
    try {
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
      const templates = (json.data || []).map((t: any) => ({
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        components: t.components || []
      }));
      
      this.templateCache = {
        data: templates,
        timestamp: Date.now()
      };

      return templates;
    } catch (error) {
      if (useCache && this.templateCache) {
        // Fallback to stale cache
        return this.templateCache.data;
      }
      throw error;
    }
  }

  static async uploadMedia(filePath: string, mimeType: string): Promise<string> {
    const config = await ProviderConfigurationService.getMetaConfiguration();
    if (!config || !config.accessToken || !config.phoneNumberId) {
      throw new Error('Meta provider is not configured properly (missing phone number ID).');
    }

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/media`;

    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    
    const fs = await import('fs/promises');
    const path = await import('path');
    const buffer = await fs.readFile(filePath);
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, path.basename(filePath));

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
