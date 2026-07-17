import { AuthProvider } from './authProvider';
import { JwtAuthProvider } from './jwtProvider';
import { ApiKeyProvider } from './apiKeyProvider';
import { FastifyRequest } from 'fastify';

class CompositeAuthProvider implements AuthProvider {
  private providers: AuthProvider[] = [
    new ApiKeyProvider(),
    new JwtAuthProvider()
  ];

  async authenticate(request: FastifyRequest): Promise<boolean> {
    for (const provider of this.providers) {
      const success = await provider.authenticate(request);
      if (success) return true;
    }
    return false;
  }

  getChallengeHeader(): string | null {
    return null;
  }
}

export const getAuthProvider = (): AuthProvider => {
  return new CompositeAuthProvider();
};
