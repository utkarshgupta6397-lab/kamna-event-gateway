import { env } from '../config/env';
import { AuthProvider } from './authProvider';
import { JwtAuthProvider } from './jwtProvider';

export const getAuthProvider = (): AuthProvider => {
  switch (env.GATEWAY_AUTH_PROVIDER) {
    case 'jwt':
      return new JwtAuthProvider();
    default:
      return new JwtAuthProvider();
  }
};
