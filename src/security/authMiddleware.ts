import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';
import { getAuthProvider } from './index';

// Exact URLs that are always public (no auth required)
const PUBLIC_EXACT = new Set([
  '/',
  '/index.html',
]);

// URL prefixes that are always public
const PUBLIC_PREFIXES = [
  '/health',
  '/webhooks',
  '/.well-known',
  '/favicon',
  '/assets',
  '/api/v1/events/test' // Making the test ingestion webhook public as per clarification
];

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const url = request.url;

  // 1. Check if route is public (exact match or prefix match)
  if (PUBLIC_EXACT.has(url) || PUBLIC_PREFIXES.some(prefix => url.startsWith(prefix))) {
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
