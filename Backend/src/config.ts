import 'dotenv/config';

const isTest = process.env.NODE_ENV === 'test';

const MONGO_URL_RE = /^(mongodb(?:\+srv)?:\/\/[^/?]+)\/?([^?]*)(\?.*)?$/;

/** Returns the database name in a MongoDB connection string ("order_console" by default). */
export function databaseName(url: string): string {
  const match = MONGO_URL_RE.exec(url);
  if (!match) throw new Error('DATABASE_URL must be a MongoDB connection string (mongodb:// or mongodb+srv://).');
  return decodeURIComponent(match[2]) || 'order_console';
}

/**
 * The automated tests wipe their database before every test, so they must never
 * run against the real one. They use a sibling database derived from
 * DATABASE_URL: ".../order_console" -> ".../order_console_test".
 */
export function toTestDatabaseUrl(url: string): string {
  const match = MONGO_URL_RE.exec(url)!;
  return `${match[1]}/${encodeURIComponent(`${databaseName(url)}_test`)}${match[3] ?? ''}`;
}

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy Backend/.env.example to Backend/.env and fill it in.');
  }
  databaseName(url); // validates the format
  return isTest ? toTestDatabaseUrl(url) : url;
}

export const config = {
  isTest,
  databaseUrl: resolveDatabaseUrl(),
  port: Number(process.env.PORT ?? 4000),
  // Comma-separated list of frontend origins allowed to call the API.
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
};
