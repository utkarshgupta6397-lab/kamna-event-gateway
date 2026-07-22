import { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { env } from '../config/env';
import { ProviderConfigurationService } from '../services/ProviderConfigurationService';
import { db } from '../db';
import { webhookEvents, providerWebhookLogs } from '../db/schema';
import { MetaWebhookProcessor } from '../services/metaWebhookProcessor';

interface CustomRequest extends FastifyRequest {
  rawBodyString?: string;
}

export interface SignatureVerificationResult {
  signaturePresent: boolean;
  signatureValid: boolean;
  signatureAlgorithm: string;
  validationError?: string | undefined;
}

/**
 * Computes and securely compares the HMAC SHA256 signature for incoming Meta webhooks.
 */
export function verifyMetaSignature(
  signatureHeader: string | undefined,
  rawBody: string,
  appSecret: string
): SignatureVerificationResult {
  if (!signatureHeader) {
    return {
      signaturePresent: false,
      signatureValid: false,
      signatureAlgorithm: 'sha256',
      validationError: 'Signature header x-hub-signature-256 is missing',
    };
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return {
      signaturePresent: true,
      signatureValid: false,
      signatureAlgorithm: parts[0] || 'unknown',
      validationError: 'Invalid signature format (expected sha256=...)',
    };
  }

  const signatureHash = parts[1];
  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const sigBuffer = Buffer.from(signatureHash, 'utf8');
  const expBuffer = Buffer.from(expectedHash, 'utf8');

  if (sigBuffer.length !== expBuffer.length) {
    return {
      signaturePresent: true,
      signatureValid: false,
      signatureAlgorithm: 'sha256',
      validationError: 'Signature hash length mismatch',
    };
  }

  const isValid = crypto.timingSafeEqual(sigBuffer, expBuffer);
  return {
    signaturePresent: true,
    signatureValid: isValid,
    signatureAlgorithm: 'sha256',
    validationError: isValid ? undefined : 'Signature hash does not match computed HMAC',
  };
}

export const webhookRoutes = async (fastify: FastifyInstance) => {
  
  // Custom JSON parser to NEVER throw on bad JSON and always capture raw payload string
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body: string, done) => {
    try {
      const json = JSON.parse(body);
      (req as CustomRequest).rawBodyString = body;
      done(null, json);
    } catch (err) {
      (req as CustomRequest).rawBodyString = body;
      done(null, { _invalidJson: true });
    }
  });

  // GET /api/v1/webhooks/meta (Meta Verification Challenge)
  fastify.get('/meta', async (request, reply) => {
    const query = request.query as Record<string, string>;
    
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    
    if (mode === 'subscribe' && token) {
      const config = await ProviderConfigurationService.getMetaConfiguration();
      
      if (config && config.verifyToken === token) {
        fastify.log.info({ provider: 'meta' }, 'Meta Webhook GET verification challenge successful');
        
        // Update DB asynchronously so we don't block response
        ProviderConfigurationService.updateVerificationStatus('whatsapp', true).catch(e => {
          fastify.log.error(e, 'Failed to update verification status');
        });
        
        return reply.status(200).send(challenge);
      } else {
        fastify.log.warn({ provider: 'meta', tokenProvided: token }, 'Meta Webhook GET verification failed: token mismatch');
        return reply.status(403).send('Forbidden');
      }
    }
    
    return reply.status(400).send('Bad Request');
  });

  // POST /api/v1/webhooks/meta (Meta Webhook Ingestion & Status Tracking)
  fastify.post('/meta', async (request, reply) => {
    const startTime = Date.now();
    const payload = request.body as Record<string, unknown> & { _invalidJson?: boolean };
    const rawBody = (request as CustomRequest).rawBodyString || '';
    const isInvalid = payload?._invalidJson;

    // Extract signature header
    const sigHeader = (request.headers['x-hub-signature-256'] || request.headers['x-hub-signature']) as string | undefined;

    // Retrieve Meta App Secret
    const metaConfig = await ProviderConfigurationService.getMetaConfiguration();
    const appSecret = metaConfig?.appSecret || process.env.META_APP_SECRET || env.META_APP_SECRET || '';

    // Signature Verification Policy
    let sigResult: SignatureVerificationResult;

    if (appSecret) {
      sigResult = verifyMetaSignature(sigHeader, rawBody, appSecret);
    } else {
      if (env.NODE_ENV === 'production') {
        fastify.log.error({ provider: 'meta' }, 'Meta App Secret is not configured in production. Rejecting webhook.');
        sigResult = {
          signaturePresent: Boolean(sigHeader),
          signatureValid: false,
          signatureAlgorithm: 'sha256',
          validationError: 'Meta App Secret is not configured in production environment',
        };
      } else {
        fastify.log.warn({ provider: 'meta' }, 'Meta App Secret is not configured. Skipping HMAC signature verification in development mode.');
        sigResult = {
          signaturePresent: Boolean(sigHeader),
          signatureValid: true,
          signatureAlgorithm: 'none',
          validationError: undefined,
        };
      }
    }

    // Determine event type for logging
    let eventType = 'unknown';
    if (payload && payload.object === 'whatsapp_business_account') {
      const entryList = (payload.entry as Array<{ changes?: Array<{ value?: { statuses?: unknown; messages?: unknown } }> }>) || [];
      for (const entry of entryList) {
        for (const change of entry.changes || []) {
          if (change?.value?.statuses) eventType = 'status';
          else if (change?.value?.messages) eventType = 'message';
        }
      }
    }

    // Reject invalid signatures immediately
    if (!sigResult.signatureValid) {
      fastify.log.warn(
        {
          provider: 'meta',
          eventType,
          signaturePresent: sigResult.signaturePresent,
          signatureValid: false,
          validationError: sigResult.validationError,
          ip: request.ip,
        },
        `Meta Webhook Rejected: ${sigResult.validationError}`
      );

      await db.insert(providerWebhookLogs).values({
        provider: 'meta',
        receivedAt: new Date(),
        httpMethod: request.method,
        requestUrl: request.url,
        headersJson: request.headers,
        bodyJson: isInvalid ? null : payload,
        rawBody: rawBody,
        ipAddress: request.ip,
        signature: sigHeader || null,
        signaturePresent: sigResult.signaturePresent,
        signatureValid: false,
        signatureAlgorithm: sigResult.signatureAlgorithm,
        validationError: sigResult.validationError,
        processingStatus: 'Rejected',
        errorMessage: sigResult.validationError,
        eventType,
        createdAt: new Date(),
      });

      return reply.status(403).send({
        success: false,
        error: 'Forbidden: Invalid signature',
        reason: sigResult.validationError,
      });
    }

    // Insert valid webhook log into DB
    const [insertedLog] = await db.insert(providerWebhookLogs).values({
      provider: 'meta',
      receivedAt: new Date(),
      httpMethod: request.method,
      requestUrl: request.url,
      headersJson: request.headers,
      bodyJson: isInvalid ? null : payload,
      rawBody: rawBody,
      ipAddress: request.ip,
      signature: sigHeader || null,
      signaturePresent: sigResult.signaturePresent,
      signatureValid: true,
      signatureAlgorithm: sigResult.signatureAlgorithm,
      validationError: null,
      processingStatus: isInvalid ? 'Failed' : 'Received',
      errorMessage: isInvalid ? 'Invalid JSON Payload' : null,
      eventType,
      createdAt: new Date(),
    }).returning();
    
    // Log successful webhook reception
    fastify.log.info(
      {
        provider: 'meta',
        eventType,
        signaturePresent: sigResult.signaturePresent,
        signatureValid: true,
        logId: insertedLog.id,
        processingTimeMs: Date.now() - startTime,
      },
      `Meta Webhook POST received [Provider: meta, EventType: ${eventType}, SigPresent: ${sigResult.signaturePresent}, SigValid: true]`
    );

    // Insert into webhookEvents for queue engine processing
    if (!isInvalid) {
      const [inserted] = await db.insert(webhookEvents).values({
        provider: 'meta',
        rawPayload: payload,
        receivedAt: new Date(),
        createdAt: new Date(),
      }).returning();
      
      // Process status / inbound message updates asynchronously
      MetaWebhookProcessor.processWebhook(inserted.id, insertedLog.id).catch(err => {
        fastify.log.error(err, `Failed to process Meta webhook ${inserted.id}`);
      });
    }

    // Return HTTP 200 to Meta immediately
    return reply.status(200).send('EVENT_RECEIVED');
  });

};
