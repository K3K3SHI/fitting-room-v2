/**
 * Postgres connection pool. Works with Vercel Postgres (Neon) out of the
 * box — that integration auto-injects POSTGRES_URL — and with any other
 * Postgres provider via DATABASE_URL, so switching providers later never
 * needs a code change.
 *
 * One pool per process, reused across requests/invocations. `ssl` is
 * required by Neon/Vercel Postgres; it's skipped for a plain local
 * "postgres://...@localhost..." URL, where SSL usually isn't configured.
 */
import { Pool } from 'pg';

let pool: Pool | null = null;

function getConnectionString(): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'No database configured. Set POSTGRES_URL (auto-set when you link Vercel Postgres) ' +
        'or DATABASE_URL in .env.local / your Vercel project.'
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false }
    });
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

/** Creates the users table on first use. Safe to call on every request. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS users (
           id UUID PRIMARY KEY,
           username TEXT NOT NULL,
           username_key TEXT NOT NULL UNIQUE,
           password_hash TEXT NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null; // allow retry on next call instead of caching a failure forever
        throw err;
      });
  }
  return schemaReady;
}
