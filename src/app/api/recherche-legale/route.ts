import { NextResponse } from 'next/server';
import { SearchRequestSchema } from '@/lib/contracts/search';
import { runSearch } from '@/lib/search/runSearch';
import { localCorpusStats } from '@/lib/search/localIndex';
import { isSupabaseServerConfigured } from '@/lib/search/supabaseSearch';

/**
 * GET  /api/recherche-legale — état du corpus (local + config Supabase)
 * POST /api/recherche-legale — recherche exacte | lexicale | sémantique | hybride
 *
 * Body POST :
 * {
 *   query: string,
 *   mode?: 'exact' | 'lexical' | 'semantic' | 'hybrid',
 *   filters?: { categories?, jurisdictions?, types?, provenance?, legalStatuses?, yearFrom?, yearTo? },
 *   limit?: number
 * }
 *
 * Compatibilité : accepte aussi { question, juridiction, categorie, limite }.
 */

export const runtime = 'nodejs';

export async function GET() {
  const local = localCorpusStats();
  return NextResponse.json({
    supabase: isSupabaseServerConfigured(),
    openai: Boolean(process.env.OPENAI_API_KEY?.startsWith('sk-')),
    localCorpus: local,
    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  // Compat anciens clients
  const normalized = {
    query: (raw.query ?? raw.question ?? '') as string,
    mode: (raw.mode ?? 'hybrid') as string,
    limit: (raw.limit ?? raw.limite ?? 12) as number,
    filters: (raw.filters as Record<string, unknown> | undefined) ?? {
      ...(raw.juridiction
        ? { jurisdictions: [String(raw.juridiction)] }
        : {}),
      ...(raw.categorie ? { categories: [String(raw.categorie)] } : {}),
    },
  };

  const parsed = SearchRequestSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json(
      {
        erreur: 'Requête invalide',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const result = await runSearch({
      query: parsed.data.query,
      mode: parsed.data.mode,
      filters: parsed.data.filters,
      limit: parsed.data.limit,
    });

    return NextResponse.json({
      ...result,
      // alias legacy
      resultats: result.resultats,
      mode_legacy: result.effectiveMode,
    });
  } catch (e) {
    return NextResponse.json(
      { erreur: `Recherche indisponible : ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
