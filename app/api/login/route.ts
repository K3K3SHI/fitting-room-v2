import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth';
import { verifyLogin } from '@/lib/users';
import { tooManyAttempts, clearAttempts, clientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const limitKey = `login:${clientIp(req)}:${username.toLowerCase()}`;
  if (tooManyAttempts(limitKey)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  let user;
  try {
    user = await verifyLogin(username, password);
  } catch {
    return NextResponse.json({ error: 'Could not check your login. Try again.' }, { status: 500 });
  }

  if (!user) {
    // Deliberately vague — never reveal whether the username or the password was wrong.
    return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 });
  }

  let token: string;
  try {
    token = await createSessionToken(user.username);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Could not create session.' }, { status: 500 });
  }

  clearAttempts(limitKey);
  const res = NextResponse.json({ ok: true, username: user.username });
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions);
  return res;
}
