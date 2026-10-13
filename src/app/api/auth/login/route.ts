import { NextResponse } from 'next/server';
import { LoginSchema } from '@/lib/contracts/matter';
import { localLogin } from '@/lib/auth/localDb';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/session';
import { maskEmail } from '@/lib/auth/crypto';
import { isSupabaseAuthEnabled, supabaseLogin } from '@/lib/auth/supabaseAuth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erreur: 'Données invalides' }, { status: 400 });
  }

  try {
    if (isSupabaseAuthEnabled()) {
      try {
        const { user, accessToken } = await supabaseLogin(
          parsed.data.email,
          parsed.data.password
        );
        const res = NextResponse.json({
          user,
          message: 'Connexion réussie (Supabase)',
          backend: 'supabase',
        });
        res.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
        res.cookies.set('jurislex_sb_access', accessToken, {
          ...sessionCookieOptions(),
          httpOnly: true,
        });
        return res;
      } catch (sbErr) {
        // hybrid: bascule locale si Supabase échoue
        if ((process.env.JURISLEX_AUTH_BACKEND || '').toLowerCase() !== 'hybrid') {
          throw sbErr;
        }
      }
    }

    const user = localLogin(parsed.data.email, parsed.data.password);
    const token = createSessionToken(user);
    const res = NextResponse.json({
      user,
      message: 'Connexion réussie',
      backend: 'local',
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.info('[auth.login.fail]', maskEmail(parsed.data.email));
    return NextResponse.json({ erreur: (e as Error).message }, { status: 401 });
  }
}
