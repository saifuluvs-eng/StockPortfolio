import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

let dbInstance: any;

if (process.env.DATABASE_URL) {
  // Production setup: use PostgreSQL
  console.log('Connecting to production database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for some cloud providers
    }
  });
  dbInstance = drizzlePostgres(pool, { schema });
  console.log('Successfully connected to production database.');
} else {
  // Development setup: use SQLite
  console.log('Using local SQLite database.');
  const sqlite = new Database('local.db');
  dbInstance = drizzleSqlite(sqlite, { schema });
}

export const db = dbInstance;