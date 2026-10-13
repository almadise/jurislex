import type { SearchHit } from '@/lib/contracts/search';

/** Forme attendue par les composants UI de recherche. */
export interface UiSearchResult {
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
  sourcePath?: string | null;
  category?: string | null;
  backend?: string;
  chunkId?: string | number | null;
  documentId?: string | null;
}

export function hitToUi(hit: SearchHit): UiSearchResult {
  return {
    id: hit.id,
    title: hit.title,
    reference: hit.reference,
    article: hit.article,
    excerpt: hit.excerpt,
    page: hit.page ?? 0,
    domain: hit.domain,
    authority: hit.authority,
    date: hit.date ?? '—',
    provenance: hit.provenance === 'secondary' ? 'secondary' : 'official',
    legalStatus: hit.legalStatus,
    matchScore: hit.matchScore,
    matchReason: hit.matchReason,
    language: hit.language === 'en' ? 'en' : 'fr',
    sourcePath: hit.sourcePath,
    category: hit.category,
    backend: hit.backend,
    chunkId: hit.chunkId,
    documentId: hit.documentId,
  };
}

/** Mappe les filtres UI (ids) vers le contrat API. */
export function uiFiltersToApi(active: Record<string, string[]>): {
  categories?: string[];
  jurisdictions?: string[];
  types?: string[];
  provenance?: ('official' | 'secondary' | 'unknown')[];
  legalStatuses?: ('verified' | 'probable' | 'unknown' | 'repealed' | 'superseded')[];
  languages?: string[];
  yearFrom?: number;
  yearTo?: number;
} {
  const out: ReturnType<typeof uiFiltersToApi> = {};

  if (active.domain?.length) out.categories = active.domain;
  if (active.authority?.length) out.jurisdictions = active.authority;
  if (active.type?.length) out.types = active.type;
  if (active.provenance?.length) {
    out.provenance = active.provenance.filter(
      (p): p is 'official' | 'secondary' | 'unknown' =>
        p === 'official' || p === 'secondary' || p === 'unknown'
    );
  }
  if (active.legalStatus?.length) {
    out.legalStatuses = active.legalStatus.filter(
      (s): s is 'verified' | 'probable' | 'unknown' | 'repealed' | 'superseded' =>
        ['verified', 'probable', 'unknown', 'repealed', 'superseded'].includes(s)
    );
  }
  if (active.language?.length) out.languages = active.language;

  if (active.yearFrom?.[0]) {
    const y = parseInt(active.yearFrom[0], 10);
    if (Number.isFinite(y)) out.yearFrom = y;
  }
  if (active.yearTo?.[0]) {
    const y = parseInt(active.yearTo[0], 10);
    if (Number.isFinite(y)) out.yearTo = y;
  }

  return out;
}
