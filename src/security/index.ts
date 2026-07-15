import { env } from '../config/env';
import { AuthProvider } from './authProvider';
import { BasicAuthProvider } from './basicProvider';

export const getAuthProvider = (): AuthProvider => {
  switch (env.GATEWAY_AUTH_PROVIDER) {
    case 'basic':
      return new BasicAuthProvider();
    // jwt provider can be added here in the future
    default:
      return new BasicAuthProvider();
  }
};
