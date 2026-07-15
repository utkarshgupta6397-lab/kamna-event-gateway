import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3004'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('./data/events.db'),
  META_APP_SECRET: z.string().optional(),
  
  // Security
  GATEWAY_AUTH_ENABLED: z.string().transform(val => val !== 'false').default('true'),
  GATEWAY_AUTH_PROVIDER: z.enum(['basic', 'jwt']).default('basic'),
  GATEWAY_BASIC_USERNAME: z.string().optional(),
  GATEWAY_BASIC_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse(process.env);
