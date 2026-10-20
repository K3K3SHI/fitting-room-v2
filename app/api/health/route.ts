import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Sanity check: confirms the server can see a token AND that the token is
 * actually valid against Replicate. Visit /api/health in a browser to
 * diagnose setup problems without spending money on a generation.
 */
export async function GET() {
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'REPLICATE_API_TOKEN is not set.',
        fix: 'Create .env.local with REPLICATE_API_TOKEN=r8_... then restart the dev server.'
      },
      { status: 500 }
    );
  }

  if (!token.startsWith('r8_')) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'REPLICATE_API_TOKEN does not look like a Replicate token (should start with "r8_").',
        fix: 'Copy a fresh token from https://replicate.com/account/api-tokens'
      },
      { status: 500 }
    );
  }

  try {
    const res = await fetch('https://api.replicate.com/v1/account', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });

    if (res.status === 401) {
      return NextResponse.json(
        {
          ok: false,
          problem: 'Replicate rejected the token (401 Unauthorized).',
          fix: 'The token is wrong or was revoked. Generate a new one and restart the server.'
        },
        { status: 401 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, problem: `Replicate returned HTTP ${res.status}.` },
        { status: 502 }
      );
    }

    const account = await res.json();
    return NextResponse.json({
      ok: true,
      message: 'Token is valid and Replicate is reachable.',
      account: account.username ?? account.name ?? null
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, problem: `Could not reach Replicate: ${err.message}` },
      { status: 502 }
    );
  }
}
