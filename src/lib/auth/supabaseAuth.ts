import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser, UserRole } from '@/lib/contracts/matter';

export function isSupabaseAuthEnabled(): boolean {
  const mode = (process.env.JURISLEX_AUTH_BACKEND || 'local').toLowerCase();
  if (mode === 'local') return false;
  if (mode === 'supabase' || mode === 'hybrid') {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy')
    );
  }
  // auto: si URL configurée
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('dummy')
  );
}

export function createAnonSupabase(): SupabaseClient | null {
  if (!isSupabaseAuthEnabled()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function supabaseSignup(input: {
  email: string;
  password: string;
  fullName: string;
  barreauNumber?: string;
}): Promise<{ user: AuthUser; accessToken: string | null }> {
  const sb = createAnonSupabase();
  if (!sb) throw new Error('Supabase Auth non configuré (JURISLEX_AUTH_BACKEND / clés).');

  // Ne jamais envoyer `role` dans user_metadata (élévation client).
  // Le trigger SQL force role = 'standard' (migration 004).
  const { data, error } = await sb.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        barreau_number: input.barreauNumber || null,
      },
    },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Inscription Supabase sans utilisateur');

  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email || input.email,
    fullName: input.fullName,
    role: 'standard',
    barreauNumber: input.barreauNumber || null,
    orgId: null,
    backend: 'supabase',
  };

  return {
    user,
    accessToken: data.session?.access_token ?? null,
  };
}

function normalizeRole(raw: string | null | undefined): UserRole {
  const r = (raw || 'standard').toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'reviewer' || r === 'lawyer' || r === 'juriste') return 'reviewer';
  return 'standard';
}

/** Charge le profil (rôle réel) depuis public.profiles, sinon user_profiles (staging). */
export async function fetchSupabaseProfile(
  userId: string,
  accessToken?: string | null
): Promise<{ role: UserRole; fullName: string | null; barreauNumber: string | null; orgId: string | null } | null> {
  const sb = createAnonSupabase();
  if (!sb) return null;
  const client = accessToken
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : sb;

  const { data, error } = await client
    .from('profiles')
    .select('role, full_name, barreau_number, org_id')
    .eq('id', userId)
    .maybeSingle();

  if (!error && data) {
    return {
      role: normalizeRole(data.role as string),
      fullName: (data.full_name as string) || null,
      barreauNumber: (data.barreau_number as string) || null,
      orgId: (data.org_id as string) || null,
    };
  }

  // Staging jurisLex : table user_profiles
  const { data: up, error: upErr } = await client
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (upErr || !up) return null;
  return {
    role: normalizeRole(up.role as string),
    fullName: (up.full_name as string) || null,
    barreauNumber: null,
    orgId: null,
  };
}

export async function supabaseLogin(
  email: string,
  password: string
): Promise<{ user: AuthUser; accessToken: string }> {
  const sb = createAnonSupabase();
  if (!sb) throw new Error('Supabase Auth non configuré.');

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('Session Supabase absente');

  const meta = data.user.user_metadata || {};
  const profile = await fetchSupabaseProfile(data.user.id, data.session.access_token);
  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email || email,
    fullName: profile?.fullName || (meta.full_name as string) || email.split('@')[0],
    // Rôle depuis profiles (source de vérité), jamais depuis metadata client
    role: profile?.role || 'standard',
    barreauNumber: profile?.barreauNumber ?? ((meta.barreau_number as string) || null),
    orgId: profile?.orgId ?? null,
    backend: 'supabase',
  };

  return { user, accessToken: data.session.access_token };
}
