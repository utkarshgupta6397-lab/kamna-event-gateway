/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthProvider } from './authProvider';
import { env } from '../config/env';

export class JwtAuthProvider implements AuthProvider {
  async authenticate(request: FastifyRequest): Promise<boolean> {
    let token = '';

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if ((request.query as any)?.token) {
      // Fallback for SSE / EventSource which cannot set headers
      token = (request.query as any).token as string;
    }

    if (!token) {
      return false;
    }

    try {
      // Verify token. If it throws, token is invalid or expired.
      jwt.verify(token, env.GATEWAY_JWT_SECRET);
      return true;
    } catch (err) {
      request.log.debug({ err }, 'JWT authentication failed');
      return false;
    }
  }

  getChallengeHeader(): string | null {
    // Return null to prevent the browser's native basic auth popup.
    // The frontend will handle 401s by redirecting to the login page.
    return null;
  }
}
