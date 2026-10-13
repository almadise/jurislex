import { NextResponse } from 'next/server';
import { SignupSchema } from '@/lib/contracts/matter';
import { localSignup } from '@/lib/auth/localDb';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/session';
import { maskEmail } from '@/lib/auth/crypto';
import { isSupabaseAuthEnabled, supabaseSignup } from '@/lib/auth/supabaseAuth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erreur: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Prod : Supabase Auth + trigger profiles (migration 002)
    if (isSupabaseAuthEnabled()) {
      // role client ignoré — toujours standard (migration 004 + trigger)
      const { user, accessToken } = await supabaseSignup({
        email: parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName,
        barreauNumber: parsed.data.barreauNumber,
      });
      const res = NextResponse.json({
        user,
        message: accessToken
          ? 'Compte créé (Supabase)'
          : 'Compte créé — confirmez l’e-mail si l’option est active dans Supabase',
        backend: 'supabase',
      });
      // Session locale de secours + token Supabase si présent
      res.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
      if (accessToken) {
        res.cookies.set('jurislex_sb_access', accessToken, {
          ...sessionCookieOptions(),
          httpOnly: true,
        });
      }
      return res;
    }

    const user = localSignup({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      barreauNumber: parsed.data.barreauNumber,
    });

    const token = createSessionToken(user);
    const res = NextResponse.json({
      user,
      message: 'Compte créé',
      backend: 'local',
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    const msg = (e as Error).message;
    console.info('[auth.signup]', maskEmail(parsed.data.email), msg);
    return NextResponse.json({ erreur: msg }, { status: 409 });
  }
}
