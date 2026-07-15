import { FastifyRequest } from 'fastify';
import { AuthProvider } from './authProvider';
import { env } from '../config/env';

export class BasicAuthProvider implements AuthProvider {
  async authenticate(request: FastifyRequest): Promise<boolean> {
    const expectedUsername = env.GATEWAY_BASIC_USERNAME;
    const expectedPassword = env.GATEWAY_BASIC_PASSWORD;

    // If no credentials configured, deny access by default for safety
    if (!expectedUsername || !expectedPassword) {
      request.log.warn('Basic Auth credentials are not configured.');
      return false;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return false;
    }

    const base64Credentials = authHeader.split(' ')[1];
    if (!base64Credentials) {
      return false;
    }

    try {
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');

      if (username === expectedUsername && password === expectedPassword) {
        return true;
      }
    } catch (err) {
      // Ignore malformed base64
    }

    return false;
  }

  getChallengeHeader(): string | null {
    return 'Basic realm="Kamna Event Gateway"';
  }
}
