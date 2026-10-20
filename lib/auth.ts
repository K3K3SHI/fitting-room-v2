/**
 * Signed-session auth. Accounts (register / login) live in lib/users.ts;
 * this file only creates and verifies the session cookie.
 *
 * Session = "<expiryEpochSeconds>.<base64url username>.<HMAC-SHA256 signature>"
 * signed with SESSION_SECRET. Uses Web Crypto (crypto.subtle) rather than
 * Node's `crypto` module because this runs in Next.js Middleware, which
 * executes on the Edge runtime by default — Web Crypto works in both Edge
 * and Node, so the same code path is used everywhere.
 */

const COOKIE_NAME = 'fr_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is not set. Add a long random string to .env.local (and to Vercel env vars).'
    );
  }
  return secret;
}

function base64urlEncode(bytes: ArrayBuffer): string {
  const b64 = Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64urlEncode(sig);
}

/** Constant-time string comparison — avoids leaking match length via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function b64urlText(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}

/** Session token = "<expiry>.<base64url username>.<HMAC signature>" */
export async function createSessionToken(username: string): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const body = `${expiry}.${b64urlText(username)}`;
  const signature = await hmac(body);
  return `${body}.${signature}`;
}

/** Returns the username the token was issued to, or null if invalid/expired. */
export async function getSessionUser(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [expiryStr, userB64, signature] = parts;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return null;

  const expected = await hmac(`${expiryStr}.${userB64}`);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    return Buffer.from(userB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  return (await getSessionUser(token)) !== null;
}

/** Cookie options shared by login and register. */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_SECONDS
};

/**
 * Defense-in-depth: reads and verifies the session cookie directly inside
 * a route handler, independent of proxy.ts. proxy.ts (the edge/network
 * boundary) is the primary gate, but Next.js middleware/proxy has had
 * real bypass vulnerabilities in the past (e.g. CVE-2025-29927, a crafted
 * header that skipped middleware entirely). Routes that spend real money
 * — the Replicate generation calls — check the session themselves too,
 * so a single boundary being bypassed isn't enough to reach them.
 */
export async function getRequestUser(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  const token = match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : undefined;
  return getSessionUser(token);
}

export async function isAuthenticated(req: Request): Promise<boolean> {
  return (await getRequestUser(req)) !== null;
}

export { COOKIE_NAME };
