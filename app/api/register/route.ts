import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth';
import { createUser, validateRegistration } from '@/lib/users';
import { tooManyAttempts, clientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (tooManyAttempts(`register:${clientIp(req)}`, 10)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  const problem = validateRegistration(username, password);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  let result;
  try {
    result = await createUser(username, password);
  } catch {
    return NextResponse.json({ error: 'Could not create the account. Try again.' }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
  }

  let token: string;
  try {
    token = await createSessionToken(result.user.username);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Could not create session.' }, { status: 500 });
  }

  // Signing up also signs you in.
  const res = NextResponse.json({ ok: true, username: result.user.username }, { status: 201 });
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions);
  return res;
}
