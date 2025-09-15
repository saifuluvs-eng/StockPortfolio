import { storage } from './server/storage';

async function seed() {
  console.log('Seeding portfolio...');
  await storage.createPortfolioPosition({
    userId: 'test-user',
    symbol: 'BTCUSDT',
    quantity: 1.5,
    entryPrice: 50000,
  });
  console.log('Portfolio seeded.');
}

seed();
