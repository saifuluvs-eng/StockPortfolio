import { storage } from './api/storage';

async function seed() {
  console.log('Seeding database...');
  await storage.upsertUser({
    id: 'test-user',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    profileImageUrl: '',
  });
  console.log('Database seeded.');
}

seed();
