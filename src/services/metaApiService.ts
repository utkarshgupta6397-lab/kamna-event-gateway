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
}
