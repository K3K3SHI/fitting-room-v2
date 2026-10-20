import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const username = await getRequestUser(req);
  if (!username) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  return NextResponse.json({ username });
}
