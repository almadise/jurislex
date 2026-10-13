import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté navigateur — clé anon uniquement.
 * RLS n'autorise que la lecture sur legal_documents et legal_chunks.
 * Aucune écriture n'est possible avec cette clé, c'est voulu :
 * l'ingestion passe exclusivement par scripts/03_upload.py (service_role).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('dummy') && !anonKey.startsWith('dummykey')
);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase n'est pas configuré. Renseigner NEXT_PUBLIC_SUPABASE_URL et " +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.'
    );
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
