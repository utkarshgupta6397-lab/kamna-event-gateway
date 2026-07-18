import { z } from 'zod';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3004'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string()
    .default('./data/events.db')
    .transform(url => url.startsWith('~/') ? url.replace('~', os.homedir()) : url),
  META_APP_SECRET: z.string().optional(),
  
  // Security
  GATEWAY_AUTH_ENABLED: z.string().transform(val => val !== 'false').default('true'),
  GATEWAY_AUTH_PROVIDER: z.enum(['basic', 'jwt']).default('jwt'),
  GATEWAY_BASIC_USERNAME: z.string().optional(),
  GATEWAY_BASIC_PASSWORD: z.string().optional(),
  GATEWAY_JWT_SECRET: z.string().default('kamna-dev-secret-key-12345'), // Default for local dev only
});

export const env = envSchema.parse(process.env);
