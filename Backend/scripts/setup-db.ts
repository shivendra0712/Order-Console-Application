/**
 * Checks the MongoDB connection from DATABASE_URL and prepares both the app
 * database and its "<name>_test" sibling used by the automated tests:
 * creates collections and indexes, and verifies transactions are supported.
 * Pass --reset to drop both databases first.
 *
 *   npm run db:setup
 *   npm run db:setup -- --reset
 */
import mongoose from 'mongoose';
import { databaseName, toTestDatabaseUrl } from '../src/config';
import { connectDb, disconnectDb } from '../src/db/connection';

const reset = process.argv.includes('--reset');

async function prepare(url: string) {
  const name = databaseName(url);
  await connectDb(url);
  try {
    if (reset) {
      await mongoose.connection.dropDatabase();
      console.log(`  dropped database "${name}"`);
      await disconnectDb();
      await connectDb(url); // recreate collections and indexes
    }
    console.log(`  database "${name}" ready (collections, indexes, transactions OK)`);
  } finally {
    await disconnectDb();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
  await prepare(url); // app database
  await prepare(toTestDatabaseUrl(url)); // "<name>_test", used by npm test
  console.log('Database setup complete.');
}

main().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
