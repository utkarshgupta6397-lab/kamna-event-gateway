/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db';
import { providerConfiguration } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../security/encryption';

export class ProviderConfigurationService {
  
  static async getConfiguration(providerName: string) {
    const [config] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, providerName));
    return config || null;
  }

  static async getMetaConfiguration() {
    const config = await this.getConfiguration('whatsapp');
    if (!config) return null;

    const settings = (config.settingsJson as Record<string, any>) || {};
    let accessToken = '';

    if (settings.encryptedAccessToken) {
      try {
        accessToken = decrypt(settings.encryptedAccessToken);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to decrypt Meta access token');
      }
    }

    let verifyToken = settings.verifyToken || '';
    if (settings.encryptedVerifyToken) {
      try {
        verifyToken = decrypt(settings.encryptedVerifyToken);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to decrypt Meta verify token');
      }
    }

    return {
      enabled: config.enabled,
      isDefault: config.isDefault,
      accessToken,
      phoneNumberId: settings.phoneNumberId,
      businessAccountId: settings.businessAccountId,
      apiVersion: settings.apiVersion || 'v19.0',
      defaultTemplate: settings.defaultTemplate,
      defaultLanguage: settings.defaultLanguage,
      testPhoneNumber: settings.testPhoneNumber,
      verifyToken,
      webhookVerified: settings.webhookVerified || false,
      lastVerificationAt: settings.lastVerificationAt,
      rawSettings: settings
    };
  }

  static async saveMetaConfiguration(payload: Record<string, any>) {
    const provider = 'whatsapp';
    const [existing] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, provider));
    
    const settings = payload.settings || {};
    
    if (settings.accessToken && settings.accessToken !== '********') {
      settings.encryptedAccessToken = encrypt(settings.accessToken);
    } else if (settings.accessToken === '********' && existing && existing.settingsJson) {
      settings.encryptedAccessToken = (existing.settingsJson as Record<string, any>).encryptedAccessToken;
    }
    delete settings.accessToken;

    if (settings.verifyToken) {
      settings.encryptedVerifyToken = encrypt(settings.verifyToken);
      delete settings.verifyToken;
    } else if (existing && existing.settingsJson && (existing.settingsJson as Record<string, any>).encryptedVerifyToken) {
      settings.encryptedVerifyToken = (existing.settingsJson as Record<string, any>).encryptedVerifyToken;
    }

    if (existing) {
      await db.update(providerConfiguration)
        .set({
          enabled: payload.enabled,
          isDefault: payload.isDefault,
          settingsJson: settings,
          updatedAt: new Date()
        })
        .where(eq(providerConfiguration.provider, provider));
    } else {
      await db.insert(providerConfiguration).values({
        provider,
        enabled: payload.enabled,
        isDefault: payload.isDefault,
        settingsJson: settings,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  static async updateVerificationStatus(providerName: string, verified: boolean) {
    const [existing] = await db.select().from(providerConfiguration).where(eq(providerConfiguration.provider, providerName));
    if (!existing) return;

    const settings = (existing.settingsJson as Record<string, any>) || {};
    settings.webhookVerified = verified;
    settings.lastVerificationAt = new Date().toISOString();

    await db.update(providerConfiguration)
      .set({
        settingsJson: settings,
        updatedAt: new Date()
      })
      .where(eq(providerConfiguration.provider, providerName));
  }
}
