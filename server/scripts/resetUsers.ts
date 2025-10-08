import 'dotenv/config';
import { firebaseAuth, firestore } from '../firebaseAdmin';
import { db } from '../db';
import {
  alerts,
  aiAnalysis,
  marketData,
  portfolioAnalytics,
  portfolioPositions,
  scanHistory,
  tradeTransactions,
  watchlist,
} from '@shared/schema';

async function deleteAllAuthUsers() {
  let totalDeleted = 0;
  let nextPageToken: string | undefined;

  do {
    const { users, pageToken } = await firebaseAuth.listUsers(1000, nextPageToken);
    if (!users.length) {
      break;
    }

    const uids = users.map((user) => user.uid);
    const { successCount, failureCount, errors } = await firebaseAuth.deleteUsers(uids);

    totalDeleted += successCount;

    if (failureCount > 0) {
      console.error('Failed to delete some Firebase Auth users:', errors);
    }

    nextPageToken = pageToken ?? undefined;
  } while (nextPageToken);

  return totalDeleted;
}

async function deleteFirestoreUsersCollection() {
  const collection = firestore.collection('users');
  const batchSize = 500;
  let totalDeleted = 0;

  // Firestore batched deletes are limited to 500 documents, loop until empty.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snapshot = await collection.limit(batchSize).get();
    if (snapshot.empty) {
      break;
    }

    const batch = firestore.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    totalDeleted += snapshot.size;
  }

  return totalDeleted;
}

async function clearSqliteData() {
  await db.delete(alerts);
  await db.delete(aiAnalysis);
  await db.delete(marketData);
  await db.delete(portfolioAnalytics);
  await db.delete(portfolioPositions);
  await db.delete(scanHistory);
  await db.delete(tradeTransactions);
  await db.delete(watchlist);
}

async function main() {
  console.log('Resetting user state...');

  const [authDeleted, firestoreDeleted] = await Promise.all([
    deleteAllAuthUsers(),
    deleteFirestoreUsersCollection(),
  ]);

  await clearSqliteData();

  console.log(`Deleted ${authDeleted} Firebase Auth user(s).`);
  console.log(`Deleted ${firestoreDeleted} Firestore user document(s).`);
  console.log('Cleared SQLite user-related tables.');
}

main()
  .then(() => {
    console.log('User reset complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to reset users:', error);
    process.exit(1);
  });
