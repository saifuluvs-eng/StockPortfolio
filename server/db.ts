import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from "@shared/schema";

let db: any;

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('dummy')) {
  console.warn('[DB] Using mock database connection (no DATABASE_URL provided or dummy used)');
  const mockQueryBuilder = {
    from: () => mockQueryBuilder,
    where: () => mockQueryBuilder,
    orderBy: () => mockQueryBuilder,
    limit: () => Promise.resolve([]),
    values: () => mockQueryBuilder,
    returning: () => Promise.resolve([]),
    set: () => mockQueryBuilder,
    onConflictDoUpdate: () => mockQueryBuilder,
  };
  db = {
    select: () => mockQueryBuilder,
    insert: () => mockQueryBuilder,
    update: () => mockQueryBuilder,
    delete: () => mockQueryBuilder,
  };
} else {
  const sql = neon(process.env.DATABASE_URL);
  db = drizzle(sql, { schema });
}

export { db };