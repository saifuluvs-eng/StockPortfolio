import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db';

async function runMigrations() {
  console.log('Running database migrations...');
  try {
    // The migrations folder needs to be specified. Drizzle Kit usually creates a `drizzle` folder.
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();
