import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { env } from '../config/env';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// Ensure the data directory exists
const dbDir = path.dirname(env.DATABASE_URL);
if (dbDir && dbDir !== '.') {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(env.DATABASE_URL);
export const db = drizzle(sqlite, { schema });

// Run migrations on startup
migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
