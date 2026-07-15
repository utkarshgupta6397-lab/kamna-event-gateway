import { FastifyRequest } from 'fastify';

export interface AuthProvider {
  /**
   * Evaluates the request to determine if it is authenticated.
   * @param request The fastify request object
   * @returns true if authenticated, false otherwise
   */
  authenticate(request: FastifyRequest): Promise<boolean>;

  /**
   * Returns the WWW-Authenticate challenge header value.
   * Return null if the provider should not challenge the client.
   */
  getChallengeHeader(): string | null;
}
