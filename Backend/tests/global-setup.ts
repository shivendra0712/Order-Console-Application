// Prepares the TEST database ("<name>_test") once before the test run.
export default async function setup() {
  process.env.NODE_ENV = 'test';
  const { connectDb, disconnectDb } = await import('../src/db/connection');
  await connectDb();
  await disconnectDb();
}
