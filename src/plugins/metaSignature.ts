import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { env } from '../config/env';

export const verifyMetaSignature = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!env.META_APP_SECRET) {
    // If no secret is configured, skip verification (useful for local dev)
    return;
  }

  const signatureHeader = request.headers['x-hub-signature-256'];
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    request.log.warn('Missing x-hub-signature-256 header');
    return reply.status(401).send({ success: false, error: 'Unauthorized: Missing signature' });
  }

  // fastify-raw-body attaches raw body to request.rawBody
  const rawBody = (request as unknown as { rawBody?: string | Buffer }).rawBody;
  if (!rawBody) {
    request.log.error('Raw body not available for signature verification');
    return reply.status(500).send({ success: false, error: 'Internal Server Error' });
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex')}`;

  if (signatureHeader !== expectedSignature) {
    request.log.warn({ expectedSignature, signatureHeader }, 'Signature mismatch');
    return reply.status(401).send({ success: false, error: 'Unauthorized: Invalid signature' });
  }
};
