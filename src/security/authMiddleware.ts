import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';
import { getAuthProvider } from './index';

// Public API endpoints that bypass authentication
const PUBLIC_API_PREFIXES = [
  '/api/v1/events/test',     // Webhook ingestion
  '/api/v1/events/publish', // Generic event publishing
  '/api/v1/auth/login'      // Login endpoint
];

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const url = request.url;

  // 1. Only enforce authentication on API routes
  // This allows the SPA, static assets, and webhooks to bypass this middleware completely.
  if (!url.startsWith('/api/')) {
    return;
  }

  // 2. Allow explicitly public API endpoints
  if (PUBLIC_API_PREFIXES.some(prefix => url.startsWith(prefix))) {
    return;
  }

  // 2. Check if auth is disabled (only allowed in development)
  if (!env.GATEWAY_AUTH_ENABLED && env.NODE_ENV === 'development') {
    return;
  }

  // 3. Delegate to Authentication Provider
  const provider = getAuthProvider();
  const isAuthenticated = await provider.authenticate(request);

  if (isAuthenticated) {
    return;
  }

  // 4. Handle Unauthorized
  const challengeHeader = provider.getChallengeHeader();
  if (challengeHeader) {
    reply.header('WWW-Authenticate', challengeHeader);
  }

  return reply.status(401).send({
    success: false,
    message: 'Unauthorized'
  });
};
