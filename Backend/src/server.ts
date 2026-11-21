import { createApp } from './app';
import { config } from './config';
import { connectDb } from './db/connection';

async function main() {
  // Fail fast with a clear message if MongoDB is unreachable or misconfigured.
  await connectDb();
  createApp().listen(config.port, () => {
    console.log(`Order Console API listening on http://localhost:${config.port}/api`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
