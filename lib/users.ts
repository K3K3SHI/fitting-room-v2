/**
 * Per-user account storage, backed by Postgres (see lib/db.ts).
 *
 * Passwords are NEVER stored in plain text — each one is hashed with
 * scrypt and a unique random salt before it touches the database.
 *
 * This used to be a JSON file on local disk. That broke on Vercel: its
 * filesystem is read-only/ephemeral, so accounts written during one
 * request could vanish before the next request landed on a different
 * serverless instance, or on any redeploy. Postgres fixes that — same
 * function signatures (createUser / verifyLogin), so nothing that calls
 * this file needed to change.
 */
import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { getPool, ensureSchema } from './db';

export interface User {
  id: string;
  username: string; // as typed at registration (display)
  usernameKey: string; // lowercase, used for uniqueness / lookup
  createdAt: number;
}

export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/* ---------- password hashing ---------- */

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt as unknown as Uint8Array, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && timingSafeEqual(expected as unknown as Uint8Array, actual as unknown as Uint8Array);
}

// Used when the username doesn't exist, so a wrong-username attempt costs the
// same time as a wrong-password one (no user enumeration via timing).
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword('not-a-real-password');
  return dummyHashPromise;
}

/* ---------- public API ---------- */

export function validateRegistration(username: string, password: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 3–30 characters: letters, numbers, dot, dash or underscore.';
  }
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (password.length > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} characters.`;
  }
  return null;
}

export type CreateResult =
  | { ok: true; user: Pick<User, 'id' | 'username'> }
  | { ok: false; reason: 'taken' };

export async function createUser(username: string, password: string): Promise<CreateResult> {
  await ensureSchema();
  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const usernameKey = username.toLowerCase();

  try {
    await getPool().query(
      `INSERT INTO users (id, username, username_key, password_hash) VALUES ($1, $2, $3, $4)`,
      [id, username, usernameKey, passwordHash]
    );
  } catch (err: any) {
    // Postgres unique_violation — someone grabbed this username first
    // (also covers two simultaneous sign-ups racing each other).
    if (err.code === '23505') return { ok: false, reason: 'taken' } as const;
    throw err;
  }

  return { ok: true, user: { id, username } } as const;
}

/** Returns the account if the credentials are right, otherwise null. */
export async function verifyLogin(
  username: string,
  password: string
): Promise<Pick<User, 'id' | 'username'> | null> {
  await ensureSchema();
  const { rows } = await getPool().query<{ id: string; username: string; password_hash: string }>(
    `SELECT id, username, password_hash FROM users WHERE username_key = $1`,
    [username.toLowerCase()]
  );
  const user = rows[0];
  const ok = await checkPassword(password, user ? user.password_hash : await getDummyHash());
  return user && ok ? { id: user.id, username: user.username } : null;
}
