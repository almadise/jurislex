import type { SearchFilters, SearchHit, SearchMode, SearchResponse } from '@/lib/contracts/search';
import {
  loadLocalChunks,
  localCorpusStats,
  searchLocalExact,
  searchLocalLexical,
  searchLocalSemanticFallback,
} from './localIndex';
import {
  createSearchClient,
  embedQuery,
  isSupabaseServerConfigured,
  searchSupabaseExact,
  searchSupabaseHybrid,
  searchSupabaseLexical,
} from './supabaseSearch';

export interface RunSearchInput {
  query: string;
  mode: SearchMode;
  filters?: SearchFilters;
  limit?: number;
}

/** Fusionne des hits multi-backends, dédupliqués, score décroissant. */
function mergeHitsByScore(hits: SearchHit[], limit: number): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  const sorted = [...hits].sort((a, b) => b.matchScore - a.matchScore);
  for (const h of sorted) {
    const key = [
      h.numero ?? '',
      h.articleNum ?? h.article,
      (h.sourcePath ?? '').replace(/\\/g, '/'),
      h.excerpt.slice(0, 80),
    ]
      .join('|')
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Orchestration recherche :
 * 1. exacte → déterministe (Supabase ou local)
 * 2. lexicale → FTS / index local
 * 3. sémantique / hybride → embeddings + RRF si dispo, sinon lexical dégradé
 *
 * Priorité exacte : en mode hybrid, les hits exacts sont préfixés.
 */
export async function runSearch(input: RunSearchInput): Promise<SearchResponse> {
  const query = input.query.trim();
  const mode = input.mode;
  const limit = input.limit ?? 12;
  const filters = input.filters;
  const warnings: string[] = [];

  const localStats = localCorpusStats();
  const hasLocal = localStats.chunks > 0;
  const hasSupabase = isSupabaseServerConfigured();
  const client = hasSupabase ? createSearchClient() : null;

  if (!hasLocal && !hasSupabase) {
    return {
      mode,
      effectiveMode: 'none',
      backend: 'none',
      query,
      resultats: [],
      total: 0,
      warnings: [
        'Aucun corpus disponible. Configurer Supabase ou lancer scripts/02_extract.py pour produire build/chunks.jsonl.',
      ],
      corpus: { documents: 0, chunks: 0 },
    };
  }

  let resultats: SearchHit[] = [];
  let effectiveMode = mode;
  let backend: SearchResponse['backend'] = hasSupabase ? 'supabase' : 'local';

  try {
    if (mode === 'exact') {
      // Fusionner Supabase + index local : le local (post-extract) est souvent
      // plus à jour que la base distante et reste déterministe.
      const parts: SearchHit[][] = [];
      if (client) {
        try {
          parts.push(await searchSupabaseExact(client, query, filters, limit));
        } catch (e) {
          warnings.push(`Exact Supabase : ${(e as Error).message}`);
        }
      }
      if (hasLocal) {
        parts.push(searchLocalExact(query, filters, limit));
      }
      resultats = mergeHitsByScore(parts.flat(), limit);
      if (parts.length > 1) {
        const backends = new Set(resultats.map((r) => r.backend));
        backend = backends.size > 1 ? 'local' : resultats[0]?.backend === 'supabase' ? 'supabase' : 'local';
        if (backends.has('local') && backends.has('supabase')) {
          warnings.push('Résultats exacts fusionnés (Supabase + index local), tri par score.');
          backend = 'local'; // dual — on signale local si au moins un hit local en tête
          if (resultats[0]?.backend === 'supabase') backend = 'supabase';
        } else if (!resultats.length) {
          backend = hasSupabase ? 'supabase' : 'local';
        } else {
          backend = resultats[0].backend;
        }
      } else {
        backend = hasLocal && !client ? 'local' : client ? 'supabase' : 'local';
      }
      effectiveMode = 'exact';
    } else if (mode === 'lexical') {
      if (client) {
        try {
          resultats = await searchSupabaseLexical(client, query, filters, limit);
        } catch (e) {
          warnings.push(`FTS Supabase indisponible : ${(e as Error).message}`);
          resultats = [];
        }
        if (!resultats.length && hasLocal) {
          resultats = searchLocalLexical(query, filters, limit);
          backend = 'local';
        }
      } else {
        resultats = searchLocalLexical(query, filters, limit);
        backend = 'local';
      }
      effectiveMode = 'lexical';
    } else {
      // semantic | hybrid
      const embedding = await embedQuery(query);
      if (client && embedding) {
        try {
          resultats = await searchSupabaseHybrid(client, query, embedding, filters, limit);
          effectiveMode = 'hybrid';
          backend = 'supabase';
        } catch (e) {
          warnings.push(`Hybride Supabase échoué : ${(e as Error).message}`);
        }
      }

      // Exact boost en tête pour hybrid
      if (mode === 'hybrid' || mode === 'semantic') {
        let exactHits: SearchHit[] = [];
        if (client) {
          exactHits = await searchSupabaseExact(client, query, filters, 5);
        }
        if (!exactHits.length && hasLocal) {
          exactHits = searchLocalExact(query, filters, 5);
        }
        if (exactHits.length) {
          const ids = new Set(resultats.map((r) => r.id));
          const boosted = exactHits.filter((h) => !ids.has(h.id));
          resultats = [...boosted, ...resultats].slice(0, limit);
          if (boosted.length) {
            warnings.push('Références exactes priorisées sur la similarité.');
          }
        }
      }

      if (!resultats.length) {
        if (client) {
          try {
            resultats = await searchSupabaseLexical(client, query, filters, limit);
            effectiveMode = 'lexical';
            warnings.push('Embeddings indisponibles — repli lexical Supabase.');
          } catch {
            /* fall through */
          }
        }
        if (!resultats.length && hasLocal) {
          resultats = searchLocalSemanticFallback(query, filters, limit);
          backend = 'local';
          effectiveMode = 'lexical';
          warnings.push(
            embedding
              ? 'Index local utilisé (lexical).'
              : 'Sans OPENAI_API_KEY : sémantique dégradée en lexical local.'
          );
        }
      }
    }
  } catch (e) {
    warnings.push(`Erreur recherche : ${(e as Error).message}`);
    if (hasLocal) {
      resultats =
        mode === 'exact'
          ? searchLocalExact(query, filters, limit)
          : searchLocalLexical(query, filters, limit);
      backend = 'local';
      effectiveMode = mode === 'exact' ? 'exact' : 'lexical';
    }
  }

  // Charger stats corpus si local
  let corpus = hasLocal
    ? localStats
    : { documents: undefined as number | undefined, chunks: undefined as number | undefined, source: 'supabase' };

  // Si local chargé en mémoire, renseigner
  if (hasLocal) {
    loadLocalChunks();
    corpus = localStats;
  }

  return {
    mode,
    effectiveMode,
    backend,
    query,
    resultats,
    total: resultats.length,
    warnings,
    corpus: {
      documents: corpus.documents,
      chunks: corpus.chunks,
      source: corpus.source,
    },
  };
}
