import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

let db: any;

if (process.env.DATABASE_URL.includes('dummy')) {
  console.warn('[DB] Using mock database connection for development');
  db = {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => [] }) }) }) }),
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
    delete: () => ({ where: () => [] }),
  };
} else {
  const sql = neon(process.env.DATABASE_URL);
  db = drizzle(sql, { schema });
}

export { db };