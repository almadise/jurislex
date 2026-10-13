import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SearchFilters, SearchHit } from '@/lib/contracts/search';
import {
  buildReference,
  domainFromCategory,
  formatDateFr,
  inferProvenance,
  mapLegalStatus,
  scoreToPercent,
} from './normalize';
import { articleMatches, expandNumeroVariants, parseExactQuery } from './exactParse';

export function isSupabaseServerConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('dummy') && !key.startsWith('dummy'));
}

export function createSearchClient(): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) return null;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface DocRow {
  id: string;
  titre: string;
  type_acte: string | null;
  numero: string | null;
  date_texte: string | null;
  juridiction: string | null;
  categorie: string | null;
  source_path: string;
  statut: string | null;
  legal_status?: string | null;
  provenance?: string | null;
  langue?: string | null;
  slug?: string | null;
}

interface ChunkRow {
  id: number;
  document_id: string;
  chunk_index: number;
  article_num: string | null;
  article_label: string | null;
  contenu: string;
  page_debut: number | null;
  page_fin: number | null;
  legal_documents?: DocRow | DocRow[] | null;
}

function unwrapDoc(d: DocRow | DocRow[] | null | undefined): DocRow | null {
  if (!d) return null;
  return Array.isArray(d) ? d[0] ?? null : d;
}

function rowToHit(
  chunk: ChunkRow,
  doc: DocRow,
  score: number,
  reason: string,
  scoreMode: 'exact' | 'lexical' | 'rrf'
): SearchHit {
  return {
    id: String(chunk.id),
    chunkId: chunk.id,
    documentId: doc.id,
    title: doc.titre,
    reference: buildReference({
      typeActe: doc.type_acte,
      numero: doc.numero,
      titre: doc.titre,
      slug: doc.slug,
    }),
    article: chunk.article_label || (chunk.article_num ? `Article ${chunk.article_num}` : '—'),
    articleNum: chunk.article_num,
    excerpt: chunk.contenu.slice(0, 480).replace(/\s+/g, ' ').trim(),
    page: chunk.page_debut,
    pageEnd: chunk.page_fin,
    domain: domainFromCategory(doc.categorie),
    category: doc.categorie,
    authority: doc.juridiction || '—',
    jurisdiction: doc.juridiction,
    typeActe: doc.type_acte,
    numero: doc.numero,
    date: formatDateFr(doc.date_texte),
    provenance: (doc.provenance as SearchHit['provenance']) || inferProvenance(doc.source_path, doc.titre),
    legalStatus: mapLegalStatus(doc.statut, doc.legal_status),
    matchScore: scoreToPercent(score, scoreMode),
    matchReason: reason,
    language: doc.langue || 'fr',
    sourcePath: doc.source_path,
    backend: 'supabase',
  };
}

function applyClientFilters(hits: SearchHit[], filters?: SearchFilters): SearchHit[] {
  if (!filters) return hits;
  return hits.filter((h) => {
    if (filters.categories?.length && !filters.categories.includes(h.category ?? '')) return false;
    if (filters.jurisdictions?.length) {
      const j = (h.jurisdiction ?? '').toLowerCase();
      if (!filters.jurisdictions.some((x) => j === x.toLowerCase() || j.includes(x.toLowerCase()))) {
        return false;
      }
    }
    if (filters.types?.length) {
      const t = (h.typeActe ?? '').toLowerCase();
      if (!filters.types.some((x) => t.includes(x.toLowerCase()))) return false;
    }
    if (filters.provenance?.length && !filters.provenance.includes(h.provenance)) return false;
    if (filters.legalStatuses?.length && !filters.legalStatuses.includes(h.legalStatus)) return false;
    if (filters.yearFrom || filters.yearTo) {
      const y = h.date ? parseInt(h.date.slice(-4), 10) : NaN;
      // date is DD/MM/YYYY
      const y2 = h.date && h.date.includes('/') ? parseInt(h.date.split('/')[2], 10) : y;
      if (!Number.isFinite(y2)) return false;
      if (filters.yearFrom && y2 < filters.yearFrom) return false;
      if (filters.yearTo && y2 > filters.yearTo) return false;
    }
    return true;
  });
}

const SELECT_CHUNKS =
  'id, document_id, chunk_index, article_num, article_label, contenu, page_debut, page_fin, legal_documents!inner(id, titre, type_acte, numero, date_texte, juridiction, categorie, source_path, statut, slug)';

function numeroMatchesDoc(
  docNumero: string | null | undefined,
  candidates: string[]
): boolean {
  if (!docNumero || !candidates.length) return false;
  const variants = new Set(
    expandNumeroVariants(docNumero).map((v) => v.toLowerCase().replace(/[./\s]/g, '-'))
  );
  for (const n of candidates) {
    const nn = n.toLowerCase().replace(/[./\s]/g, '-');
    if (variants.has(nn)) return true;
    for (const v of variants) {
      if (v.includes(nn) || nn.includes(v)) return true;
    }
  }
  return false;
}

export async function searchSupabaseExact(
  client: SupabaseClient,
  query: string,
  filters?: SearchFilters,
  limit = 12
): Promise<SearchHit[]> {
  const parsed = parseExactQuery(query);
  const hits: SearchHit[] = [];

  // 1) RPC get_article si numéro + article (toutes variantes de numéro)
  if (parsed.articleNum && parsed.textNumbers.length) {
    for (const num of parsed.textNumbers.slice(0, 8)) {
      const { data, error } = await client.rpc('get_article', {
        p_numero_texte: num,
        p_article: parsed.articleNum,
      });
      if (error || !data?.length) continue;
      for (const row of data as {
        titre: string;
        article_label: string;
        contenu: string;
        source_path: string;
        page_debut?: number;
        document_id?: string;
        chunk_id?: number;
      }[]) {
        hits.push({
          id: String(row.chunk_id ?? `exact-${num}-${parsed.articleNum}-${hits.length}`),
          chunkId: row.chunk_id ?? null,
          documentId: row.document_id ?? null,
          title: row.titre,
          reference: buildReference({ numero: num, titre: row.titre }),
          article: row.article_label || `Article ${parsed.articleNum}`,
          articleNum: parsed.articleNum,
          excerpt: row.contenu.slice(0, 480).replace(/\s+/g, ' ').trim(),
          page: row.page_debut ?? null,
          pageEnd: null,
          domain: domainFromCategory(null),
          category: null,
          authority: '—',
          jurisdiction: null,
          typeActe: null,
          numero: num,
          date: null,
          provenance: inferProvenance(row.source_path, row.titre),
          legalStatus: 'unknown',
          matchScore: 98,
          matchReason: `Référence exacte · n° ${num} · Art. ${parsed.articleNum}`,
          language: 'fr',
          sourcePath: row.source_path,
          backend: 'supabase',
        });
      }
    }
  }

  // 2) Requête directe : article_num (+ numéro texte si fourni)
  if (parsed.articleNum) {
    let q = client
      .from('legal_chunks')
      .select(SELECT_CHUNKS)
      .eq('article_num', parsed.articleNum)
      .limit(120);

    if (filters?.categories?.length === 1) {
      q = q.eq('legal_documents.categorie', filters.categories[0]);
    }
    if (filters?.jurisdictions?.length === 1) {
      q = q.eq('legal_documents.juridiction', filters.jurisdictions[0]);
    }
    // Si un numéro de texte est demandé, filtrer côté PostgREST quand possible
    if (parsed.textNumbers.length === 1) {
      q = q.eq('legal_documents.numero', parsed.textNumbers[0]);
    }

    const { data, error } = await q;
    if (!error && data) {
      for (const raw of data as ChunkRow[]) {
        const doc = unwrapDoc(raw.legal_documents);
        if (!doc) continue;
        if (!articleMatches(raw.article_num, parsed.articleNum)) continue;

        const hasTextNum = parsed.textNumbers.length > 0;
        const numOk = hasTextNum ? numeroMatchesDoc(doc.numero, parsed.textNumbers) : true;

        // Si l'utilisateur a fourni un n° de texte, exclure les articles du même numéro sans match
        if (hasTextNum && !numOk) continue;

        let score = hasTextNum && numOk ? 96 : 55;
        const reasons = [`Article ${parsed.articleNum}`];
        if (numOk && doc.numero) {
          reasons.push(`N° ${doc.numero}`);
        }

        if (parsed.keywords.length) {
          const hay = `${doc.titre} ${doc.numero ?? ''} ${doc.categorie ?? ''}`.toLowerCase();
          const kwHits = parsed.keywords.filter((k) => hay.includes(k)).length;
          if (kwHits) {
            score = Math.min(100, score + Math.min(10, kwHits * 3));
            reasons.push('Titre');
          }
        }

        hits.push(rowToHit(raw, doc, score, `Référence exacte · ${reasons.join(' · ')}`, 'exact'));
      }
    }

    // Si filtre numero strict a tout éliminé, 2e passe sans eq numero puis filtre JS
    if (hasTextNumNeedsFallback(parsed.textNumbers, hits)) {
      const { data: data2 } = await client
        .from('legal_chunks')
        .select(SELECT_CHUNKS)
        .eq('article_num', parsed.articleNum)
        .limit(150);
      for (const raw of (data2 ?? []) as ChunkRow[]) {
        const doc = unwrapDoc(raw.legal_documents);
        if (!doc || !articleMatches(raw.article_num, parsed.articleNum)) continue;
        if (!numeroMatchesDoc(doc.numero, parsed.textNumbers)) continue;
        hits.push(
          rowToHit(
            raw,
            doc,
            96,
            `Référence exacte · Article ${parsed.articleNum} · N° ${doc.numero}`,
            'exact'
          )
        );
      }
    }
  }

  // 3) Recherche par numéro seul
  if (!parsed.articleNum && parsed.textNumbers.length) {
    for (const num of parsed.textNumbers.slice(0, 6)) {
      const { data } = await client
        .from('legal_chunks')
        .select(SELECT_CHUNKS)
        .eq('legal_documents.numero', num)
        .limit(30);
      if (!data) continue;
      for (const raw of data as ChunkRow[]) {
        const doc = unwrapDoc(raw.legal_documents);
        if (!doc) continue;
        hits.push(rowToHit(raw, doc, 85, `Référence exacte · n° ${doc.numero}`, 'exact'));
      }
    }
  }

  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const k = `${h.documentId ?? h.sourcePath}|${h.articleNum ?? h.article}|${h.chunkId ?? h.excerpt.slice(0, 40)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  unique.sort((a, b) => b.matchScore - a.matchScore);
  return applyClientFilters(unique, filters).slice(0, limit);
}

function hasTextNumNeedsFallback(textNumbers: string[], hits: SearchHit[]): boolean {
  return textNumbers.length > 0 && hits.filter((h) => h.matchScore >= 90).length === 0;
}

export async function searchSupabaseLexical(
  client: SupabaseClient,
  query: string,
  filters?: SearchFilters,
  limit = 12
): Promise<SearchHit[]> {
  let q = client
    .from('legal_chunks')
    .select(SELECT_CHUNKS)
    .textSearch('fts', query, { type: 'websearch', config: 'fr_unaccent' })
    .limit(Math.min(limit * 3, 50));

  if (filters?.categories?.length === 1) {
    q = q.eq('legal_documents.categorie', filters.categories[0]);
  }
  if (filters?.jurisdictions?.length === 1) {
    q = q.eq('legal_documents.juridiction', filters.jurisdictions[0]);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Recherche lexicale Supabase : ${error.message}`);

  const hits: SearchHit[] = [];
  for (const raw of (data ?? []) as ChunkRow[]) {
    const doc = unwrapDoc(raw.legal_documents);
    if (!doc) continue;
    // score ordinal décroissant
    const ordinal = 1 - hits.length / Math.max(limit * 3, 1);
    hits.push(rowToHit(raw, doc, ordinal * 0.9 + 0.05, 'Correspondance lexicale', 'lexical'));
  }
  return applyClientFilters(hits, filters).slice(0, limit);
}

export async function searchSupabaseHybrid(
  client: SupabaseClient,
  query: string,
  embedding: number[],
  filters?: SearchFilters,
  limit = 12
): Promise<SearchHit[]> {
  const { data, error } = await client.rpc('search_legal_base', {
    query_text: query,
    query_embedding: embedding,
    match_count: limit,
    filtre_juridiction: filters?.jurisdictions?.[0] ?? null,
    filtre_categorie: filters?.categories?.[0] ?? null,
  });

  if (error) throw new Error(`Recherche hybride : ${error.message}`);

  const hits: SearchHit[] = ((data ?? []) as {
    chunk_id: number;
    document_id: string;
    titre: string;
    type_acte: string | null;
    numero: string | null;
    juridiction: string | null;
    categorie: string | null;
    article_label: string | null;
    contenu: string;
    page_debut: number | null;
    source_path: string;
    score: number;
  }[]).map((r) => ({
    id: String(r.chunk_id),
    chunkId: r.chunk_id,
    documentId: r.document_id,
    title: r.titre,
    reference: buildReference({
      typeActe: r.type_acte,
      numero: r.numero,
      titre: r.titre,
    }),
    article: r.article_label || '—',
    articleNum: null,
    excerpt: r.contenu.slice(0, 480).replace(/\s+/g, ' ').trim(),
    page: r.page_debut,
    pageEnd: null,
    domain: domainFromCategory(r.categorie),
    category: r.categorie,
    authority: r.juridiction || '—',
    jurisdiction: r.juridiction,
    typeActe: r.type_acte,
    numero: r.numero,
    date: null,
    provenance: inferProvenance(r.source_path, r.titre),
    legalStatus: mapLegalStatus('en_vigueur', 'probable'),
    matchScore: scoreToPercent(r.score, 'rrf'),
    matchReason: 'Recherche hybride (vectoriel + plein texte)',
    language: 'fr',
    sourcePath: r.source_path,
    backend: 'supabase' as const,
  }));

  return applyClientFilters(hits, filters);
}

export async function embedQuery(query: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.startsWith('sk-')) return null;

  const rep = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536,
    }),
  });
  if (!rep.ok) return null;
  const json = (await rep.json()) as { data: { embedding: number[] }[] };
  return json.data[0]?.embedding ?? null;
}
