import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

// force-dynamic + revalidate 0 + fetch's own cache:'no-store' below is
// belt-and-suspenders: this route must NEVER return a cached prediction
// status, or the frontend will keep polling a stale "processing" result
// forever even after the job has actually succeeded on Replicate's side.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Defense-in-depth alongside proxy.ts — see lib/auth.ts for why.
    if (!(await isAuthenticated(_req))) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { id } = await params;

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN is not set on the server.' },
        { status: 500 }
      );
    }

    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
      cache: 'no-store'
    });

    // Defensive: don't assume the response body is JSON. If Replicate (or
    // anything sitting in front of it - a proxy, a gateway timeout page)
    // ever returns non-JSON, surface a clean error instead of throwing an
    // unhandled parse exception.
    const raw = await res.text();
    let data: any;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json(
        { error: `Replicate returned a non-JSON response (HTTP ${res.status}).` },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || `Could not fetch prediction (HTTP ${res.status}).` },
        { status: res.status }
      );
    }

    return NextResponse.json({
      id: data.id,
      status: data.status,
      output: data.output ?? null,
      error: data.error ?? null
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Could not fetch prediction.' }, { status: 500 });
  }
}
