import mongoose, { type ClientSession } from 'mongoose';
import { config, databaseName } from '../config';
import { Counter } from '../models/Counter';
import { Order } from '../models/Order';
import { Product } from '../models/Product';

const models = [Product, Order, Counter];

/**
 * Connects to MongoDB, makes sure collections and indexes exist (collections
 * cannot be created implicitly inside every transaction), and checks that the
 * server supports transactions.
 */
export async function connectDb(url = config.databaseUrl): Promise<void> {
  await mongoose.connect(url, { serverSelectionTimeoutMS: 5000, dbName: databaseName(url) });
  await assertTransactionsSupported();
  for (const model of models) {
    await model.createCollection();
    await model.syncIndexes();
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

/** Order placement and cancellation rely on multi-document transactions. */
async function assertTransactionsSupported(): Promise<void> {
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error(
      'MongoDB is running as a standalone server, but this app needs transactions (a replica set). ' +
        'Start mongod with --replSet rs0 and run rs.initiate() once, or use MongoDB Atlas. See README.',
    );
  }
}

/**
 * Runs `fn` in a multi-document transaction. Mongoose retries the whole callback
 * on transient errors (e.g. a write conflict with a concurrent order), so `fn`
 * must re-read anything it depends on — which it does by querying inside it.
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  let result!: T;
  await mongoose.connection.transaction(async (session) => {
    result = await fn(session);
  });
  return result;
}

/** Deletes all data and resets the order reference counter. */
export async function clearDatabase(): Promise<void> {
  await Promise.all([Product.deleteMany({}), Order.deleteMany({}), Counter.deleteMany({})]);
}
