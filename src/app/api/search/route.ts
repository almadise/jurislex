import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SearchResult {
  id: string;
  title: string;
  reference: string;
  article: string;
  excerpt: string;
  page: number;
  domain: string;
  authority: string;
  date: string;
  provenance: 'official' | 'secondary';
  legalStatus: 'verified' | 'probable' | 'unknown' | 'repealed' | 'superseded';
  matchScore: number;
  matchReason: string;
  language: 'fr' | 'en';
}

interface ProvisionRow {
  id: string;
  title: string;
  reference: string;
  article: string;
  excerpt: string;
  page_number: number;
  domain: string;
  authority: string;
  provision_date: string;
  provenance: string;
  legal_status: string;
  language: string;
  match_score: number;
  match_reason: string;
}

function mapRow(row: ProvisionRow): SearchResult {
  return {
    id: row.id,
    title: row.title,
    reference: row.reference,
    article: row.article,
    excerpt: row.excerpt,
    page: row.page_number,
    domain: row.domain,
    authority: row.authority,
    date: row.provision_date,
    provenance: row.provenance as 'official' | 'secondary',
    legalStatus: row.legal_status as SearchResult['legalStatus'],
    matchScore: Math.min(100, Math.max(0, Math.round(row.match_score))),
    matchReason: row.match_reason,
    language: row.language as 'fr' | 'en',
  };
}

function buildFilterArrays(filters: Record<string, string[]>) {
  const domainMap: Record<string, string> = {
    'ohada-commercial': 'Droit commercial OHADA',
    'travail': 'Droit du travail',
    'civil': 'Droit civil',
    'societes': 'Droit des sociétés',
    'penal': 'Droit pénal',
    'foncier': 'Droit foncier',
    'bancaire': 'Droit bancaire COBAC',
    'numerique': 'Droit numérique',
  };
  const authorityMap: Record<string, string> = {
    'ohada': 'OHADA',
    'cameroun': 'République du Cameroun',
    'cobac': 'COBAC',
    'cemac': 'CEMAC',
    'cima': 'CIMA',
  };

  const domainValues = (filters.domain || []).map((v) => domainMap[v] || v);
  const authorityValues = (filters.authority || []).map((v) => authorityMap[v] || v);
  const legalStatusValues = filters.legalStatus || [];
  const provenanceValues = filters.provenance || [];
  const languageValues = filters.language || [];

  return {
    filterDomain: domainValues.length > 0 ? domainValues : null,
    filterAuthority: authorityValues.length > 0 ? authorityValues : null,
    filterLegalStatus: legalStatusValues.length > 0 ? legalStatusValues : null,
    filterProvenance: provenanceValues.length > 0 ? provenanceValues : null,
    filterLanguage: languageValues.length > 0 ? languageValues : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, mode, filters = {} } = body as {
      query: string;
      mode: 'exact' | 'lexical' | 'semantic';
      filters: Record<string, string[]>;
    };

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const { filterDomain, filterAuthority, filterLegalStatus, filterProvenance, filterLanguage } =
      buildFilterArrays(filters);

    let results: SearchResult[] = [];

    if (mode === 'exact') {
      // Exact reference matching — deterministic, prioritised
      const { data, error } = await supabase.rpc('search_provisions_exact', {
        query_text: query.trim(),
        filter_domain: filterDomain,
        filter_authority: filterAuthority,
        filter_legal_status: filterLegalStatus,
        filter_provenance: filterProvenance,
        filter_language: filterLanguage,
        result_limit: 20,
      });
      if (error) {
        console.error('[search/exact] Supabase RPC error:', JSON.stringify(error));
        throw new Error(error.message || 'Erreur RPC exact');
      }
      results = (data as ProvisionRow[]).map(mapRow);

    } else if (mode === 'lexical') {
      // PostgreSQL full-text search
      const { data, error } = await supabase.rpc('search_provisions_lexical', {
        query_text: query.trim(),
        filter_domain: filterDomain,
        filter_authority: filterAuthority,
        filter_legal_status: filterLegalStatus,
        filter_provenance: filterProvenance,
        filter_language: filterLanguage,
        result_limit: 20,
      });
      if (error) {
        console.error('[search/lexical] Supabase RPC error:', JSON.stringify(error));
        throw new Error(error.message || 'Erreur RPC lexical');
      }
      results = (data as ProvisionRow[]).map(mapRow);

    } else {
      // Semantic mode: OpenAI embedding + pgvector + hybrid re-ranking
      // 1. Generate embedding for the query
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query.trim(),
        dimensions: 1536,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // 2. Vector similarity search
      const { data: semanticData, error: semanticError } = await supabase.rpc(
        'search_provisions_semantic',
        {
          query_embedding: queryEmbedding,
          filter_domain: filterDomain,
          filter_authority: filterAuthority,
          filter_legal_status: filterLegalStatus,
          filter_provenance: filterProvenance,
          filter_language: filterLanguage,
          result_limit: 30,
        }
      );
      if (semanticError) {
        console.error('[search/semantic] Supabase RPC error:', JSON.stringify(semanticError));
        throw new Error(semanticError.message || 'Erreur RPC sémantique');
      }

      // 3. Also run lexical search for hybrid re-ranking
      const { data: lexicalData } = await supabase.rpc('search_provisions_lexical', {
        query_text: query.trim(),
        filter_domain: filterDomain,
        filter_authority: filterAuthority,
        filter_legal_status: filterLegalStatus,
        filter_provenance: filterProvenance,
        filter_language: filterLanguage,
        result_limit: 30,
      });

      // 4. Hybrid re-ranking: combine scores with RRF (Reciprocal Rank Fusion)
      const semanticRows = (semanticData as ProvisionRow[]) || [];
      const lexicalRows = (lexicalData as ProvisionRow[]) || [];

      const scoreMap = new Map<string, { row: ProvisionRow; hybridScore: number }>();
      const k = 60; // RRF constant

      semanticRows.forEach((row, rank) => {
        const rrf = 1 / (k + rank + 1);
        scoreMap.set(row.id, { row, hybridScore: rrf });
      });

      lexicalRows.forEach((row, rank) => {
        const rrf = 1 / (k + rank + 1);
        const existing = scoreMap.get(row.id);
        if (existing) {
          existing.hybridScore += rrf;
          // Prefer lexical match_reason when both match
          existing.row.match_reason = 'Correspondance hybride';
        } else {
          scoreMap.set(row.id, { row, hybridScore: rrf });
        }
      });

      // 5. Also check for exact reference matches — boost them to top
      const { data: exactData } = await supabase.rpc('search_provisions_exact', {
        query_text: query.trim(),
        filter_domain: filterDomain,
        filter_authority: filterAuthority,
        filter_legal_status: filterLegalStatus,
        filter_provenance: filterProvenance,
        filter_language: filterLanguage,
        result_limit: 5,
      });

      const exactRows = (exactData as ProvisionRow[]) || [];
      exactRows.forEach((row) => {
        const existing = scoreMap.get(row.id);
        if (existing) {
          existing.hybridScore += 1.0; // Strong boost for exact matches
          existing.row.match_reason = 'Référence exacte';
          existing.row.match_score = Math.max(existing.row.match_score, 95);
        } else {
          scoreMap.set(row.id, {
            row: { ...row, match_reason: 'Référence exacte' },
            hybridScore: 1.0,
          });
        }
      });

      // 6. Sort by hybrid score and normalise match_score to 0-100
      const sorted = Array.from(scoreMap.values())
        .sort((a, b) => b.hybridScore - a.hybridScore)
        .slice(0, 20);

      const maxHybrid = sorted[0]?.hybridScore || 1;
      results = sorted.map(({ row, hybridScore }) => {
        const normalisedScore = Math.round((hybridScore / maxHybrid) * 100);
        return mapRow({ ...row, match_score: normalisedScore });
      });
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    console.error('[search] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
