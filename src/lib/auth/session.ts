import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { AuthUser } from '@/lib/contracts/matter';
import { signSession, verifySession } from './crypto';
import { localGetUser } from './localDb';

export const SESSION_COOKIE = 'jurislex_session';

interface SessionPayload {
  sub: string;
  backend: 'local' | 'supabase';
  exp?: number;
}

export function createSessionToken(user: AuthUser): string {
  return signSession({ sub: user.id, backend: user.backend });
}

export function sessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function setSessionCookie(user: AuthUser): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export function readTokenFromRequest(request: NextRequest | Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  // Cookie header manuel (route handlers)
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (match) return decodeURIComponent(match[1]);
  return null;
}

export async function getSessionUser(request?: NextRequest | Request): Promise<AuthUser | null> {
  let token: string | null = null;
  if (request) {
    token = readTokenFromRequest(request);
  } else {
    try {
      const jar = await cookies();
      token = jar.get(SESSION_COOKIE)?.value ?? null;
    } catch {
      token = null;
    }
  }
  if (!token) return null;

  // Session locale signée
  const local = verifySession<SessionPayload>(token);
  if (local?.sub) {
    return localGetUser(local.sub);
  }

  // JWT Supabase (si configuré) — rôle depuis public.profiles, pas metadata
  if (token.split('.').length === 3 && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const { fetchSupabaseProfile } = await import('./supabaseAuth');
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const sb = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data.user) return null;
      const meta = data.user.user_metadata ?? {};
      const profile = await fetchSupabaseProfile(data.user.id, token);
      return {
        id: data.user.id,
        email: data.user.email ?? '',
        fullName:
          profile?.fullName ||
          (meta.full_name as string) ||
          data.user.email?.split('@')[0] ||
          'Utilisateur',
        role: profile?.role || 'standard',
        barreauNumber: profile?.barreauNumber ?? ((meta.barreau_number as string) || null),
        orgId: profile?.orgId ?? null,
        backend: 'supabase',
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function requireUser(user: AuthUser | null): AuthUser {
  if (!user) {
    const err = new Error('Authentification requise');
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  return user;
}
