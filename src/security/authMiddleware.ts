import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';
import { getAuthProvider } from './index';

/**
 * Public API endpoints that explicitly bypass Gateway authentication.
 */
const PUBLIC_API_PREFIXES = [
  '/api/v1/events/test',     // Webhook ingestion test
  '/api/v1/events/publish',  // Generic event publishing
  '/api/v1/auth/login'       // Login endpoint
];

/**
 * Public Webhook Endpoints Architecture.
 * 
 * All provider webhook endpoints under `/api/v1/webhooks/` bypass Gateway API Key & JWT
 * authentication because third-party webhook providers (e.g., Meta/WhatsApp, Twilio, SendGrid)
 * cannot include custom Gateway authorization headers.
 * 
 * Security for all webhook endpoints is instead delegated to provider-specific signature
 * verification (e.g., Meta X-Hub-Signature-256 HMAC-SHA256 verification) inside route handlers.
 * 
 * This array automatically supports all existing and future webhook providers:
 * - /api/v1/webhooks/meta
 * - /api/v1/webhooks/twilio
 * - /api/v1/webhooks/email
 * - /api/v1/webhooks/sms
 */
const PUBLIC_WEBHOOK_PREFIXES = [
  '/api/v1/webhooks/'
];

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const url = request.url;

  // 1. Only enforce authentication on API routes
  if (!url.startsWith('/api/')) {
    return;
  }

  // 2. Allow explicitly public API endpoints
  if (PUBLIC_API_PREFIXES.some(prefix => url.startsWith(prefix))) {
    return;
  }

  // 3. Allow public provider webhooks (authenticated via provider signatures in route handlers)
  if (PUBLIC_WEBHOOK_PREFIXES.some(prefix => url.startsWith(prefix))) {
    return;
  }

  // 4. Check if auth is disabled (only allowed in development)
  if (!env.GATEWAY_AUTH_ENABLED && env.NODE_ENV === 'development') {
    return;
  }

  // 5. Delegate to Authentication Provider (JWT / API Key)
  const provider = getAuthProvider();
  const isAuthenticated = await provider.authenticate(request);

  if (isAuthenticated) {
    return;
  }

  // 6. Handle Unauthorized
  const challengeHeader = provider.getChallengeHeader();
  if (challengeHeader) {
    reply.header('WWW-Authenticate', challengeHeader);
  }

  return reply.status(401).send({
    success: false,
    message: 'Unauthorized'
  });
};
