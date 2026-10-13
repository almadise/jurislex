import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user });
}
