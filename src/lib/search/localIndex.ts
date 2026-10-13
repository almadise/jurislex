import fs from 'fs';
import path from 'path';
import type { SearchFilters, SearchHit } from '@/lib/contracts/search';
import {
  buildReference,
  domainFromCategory,
  formatDateFr,
  inferProvenance,
  mapLegalStatus,
  scoreToPercent,
} from './normalize';
import { articleMatches, parseExactQuery } from './exactParse';

export interface LocalChunk {
  key: string;
  chunkIndex: number;
  articleNum: string | null;
  articleLabel: string | null;
  contenu: string;
  pageDebut: number | null;
  pageFin: number | null;
  document: {
    slug: string;
    titre: string;
    typeActe: string | null;
    numero: string | null;
    dateTexte: string | null;
    juridiction: string | null;
    categorie: string | null;
    sourcePath: string;
    sha256: string | null;
    nbPages: number | null;
    ocr: boolean;
  };
  /** Texte normalisé pour matching lexical. */
  haystack: string;
}

let cache: { path: string; mtimeMs: number; chunks: LocalChunk[] } | null = null;

export function getChunksPath(): string {
  const rel = process.env.JURISLEX_CHUNKS_PATH || 'build/chunks.jsonl';
  return path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
}

export function loadLocalChunks(): LocalChunk[] {
  const filePath = getChunksPath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const stat = fs.statSync(filePath);
  if (cache && cache.path === filePath && cache.mtimeMs === stat.mtimeMs) {
    return cache.chunks;
  }

  const chunks: LocalChunk[] = [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as {
        document: Record<string, unknown>;
        chunk_index: number;
        article_num: string | null;
        article_label: string | null;
        contenu: string;
        page_debut?: number | null;
        page_fin?: number | null;
      };
      const d = o.document;
      const titre = String(d.titre ?? '');
      const sourcePath = String(d.source_path ?? '');
      const articleLabel = o.article_label ? String(o.article_label) : null;
      const contenu = String(o.contenu ?? '');
      const haystack = normalizeText(
        [titre, String(d.numero ?? ''), String(d.type_acte ?? ''), articleLabel ?? '', contenu].join(
          ' '
        )
      );
      chunks.push({
        key: `${d.slug}#${o.chunk_index}`,
        chunkIndex: o.chunk_index,
        articleNum: o.article_num != null ? String(o.article_num) : null,
        articleLabel,
        contenu,
        pageDebut: o.page_debut ?? null,
        pageFin: o.page_fin ?? null,
        document: {
          slug: String(d.slug),
          titre,
          typeActe: d.type_acte != null ? String(d.type_acte) : null,
          numero: d.numero != null ? String(d.numero) : null,
          dateTexte: d.date_texte != null ? String(d.date_texte) : null,
          juridiction: d.juridiction != null ? String(d.juridiction) : null,
          categorie: d.categorie != null ? String(d.categorie) : null,
          sourcePath,
          sha256: d.sha256 != null ? String(d.sha256) : null,
          nbPages: typeof d.nb_pages === 'number' ? d.nb_pages : null,
          ocr: Boolean(d.ocr),
        },
        haystack,
      });
    } catch {
      // ligne corrompue : ignorer
    }
  }

  cache = { path: filePath, mtimeMs: stat.mtimeMs, chunks };
  return chunks;
}

export function localCorpusStats(): { documents: number; chunks: number; source: string } {
  const chunks = loadLocalChunks();
  const docs = new Set(chunks.map((c) => c.document.slug));
  return {
    documents: docs.size,
    chunks: chunks.length,
    source: getChunksPath(),
  };
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(q: string): string[] {
  return normalizeText(q)
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function passesFilters(c: LocalChunk, filters?: SearchFilters): boolean {
  if (!filters) return true;
  const d = c.document;
  if (filters.categories?.length && !filters.categories.includes(d.categorie ?? '')) {
    return false;
  }
  if (filters.jurisdictions?.length) {
    const j = (d.juridiction ?? '').toLowerCase();
    if (!filters.jurisdictions.some((x) => j === x.toLowerCase() || j.includes(x.toLowerCase()))) {
      return false;
    }
  }
  if (filters.types?.length) {
    const t = (d.typeActe ?? '').toLowerCase();
    if (!filters.types.some((x) => t.includes(x.toLowerCase()))) return false;
  }
  const prov = inferProvenance(d.sourcePath, d.titre);
  if (filters.provenance?.length && !filters.provenance.includes(prov)) return false;

  const legal = mapLegalStatus(null, 'unknown');
  if (filters.legalStatuses?.length && !filters.legalStatuses.includes(legal)) return false;

  if (filters.yearFrom || filters.yearTo) {
    const y = d.dateTexte ? parseInt(d.dateTexte.slice(0, 4), 10) : NaN;
    if (!Number.isFinite(y)) return false;
    if (filters.yearFrom && y < filters.yearFrom) return false;
    if (filters.yearTo && y > filters.yearTo) return false;
  }
  return true;
}

function toHit(
  c: LocalChunk,
  score: number,
  reason: string,
  scoreMode: 'exact' | 'lexical' | 'rrf'
): SearchHit {
  const d = c.document;
  return {
    id: c.key,
    chunkId: c.chunkIndex,
    documentId: d.slug,
    title: d.titre,
    reference: buildReference({
      typeActe: d.typeActe,
      numero: d.numero,
      titre: d.titre,
      slug: d.slug,
    }),
    article: c.articleLabel || (c.articleNum ? `Article ${c.articleNum}` : '—'),
    articleNum: c.articleNum,
    excerpt: c.contenu.slice(0, 480).replace(/\s+/g, ' ').trim(),
    page: c.pageDebut,
    pageEnd: c.pageFin,
    domain: domainFromCategory(d.categorie),
    category: d.categorie,
    authority: d.juridiction || '—',
    jurisdiction: d.juridiction,
    typeActe: d.typeActe,
    numero: d.numero,
    date: formatDateFr(d.dateTexte),
    provenance: inferProvenance(d.sourcePath, d.titre),
    legalStatus: mapLegalStatus(null, 'unknown'),
    matchScore: scoreToPercent(score, scoreMode),
    matchReason: reason,
    language: 'fr',
    sourcePath: d.sourcePath,
    backend: 'local',
  };
}

export function searchLocalExact(query: string, filters?: SearchFilters, limit = 12): SearchHit[] {
  const parsed = parseExactQuery(query);
  const all = loadLocalChunks().filter((c) => passesFilters(c, filters));
  const scored: { c: LocalChunk; score: number; reason: string }[] = [];

  for (const c of all) {
    let score = 0;
    const reasons: string[] = [];
    const d = c.document;

    const articleOk =
      Boolean(parsed.articleNum) && articleMatches(c.articleNum, parsed.articleNum!);

    let numeroOk = false;
    if (parsed.textNumbers.length && d.numero) {
      const numNorm = d.numero.replace(/[./\s]/g, '-').toLowerCase();
      for (const n of parsed.textNumbers) {
        const nn = n.toLowerCase().replace(/[./\s]/g, '-');
        if (numNorm === nn || numNorm.includes(nn) || nn.includes(numNorm)) {
          numeroOk = true;
          break;
        }
      }
    }

    // Si l'utilisateur a fourni un n° de texte, il est obligatoire (déterministe).
    if (parsed.textNumbers.length > 0 && !numeroOk) {
      continue;
    }
    // Si un numéro d'article est demandé, exclure les autres dispositions du même texte.
    if (parsed.articleNum && !articleOk) {
      continue;
    }

    if (articleOk) {
      score += 60;
      reasons.push(`Article ${parsed.articleNum}`);
    }

    if (numeroOk && d.numero) {
      score += 50;
      reasons.push(`N° ${d.numero}`);
    }

    if (parsed.keywords.length) {
      let hits = 0;
      for (const kw of parsed.keywords) {
        if (c.haystack.includes(kw)) hits += 1;
      }
      if (hits > 0) {
        score += Math.min(30, hits * 8);
        if (hits >= Math.ceil(parsed.keywords.length * 0.5)) {
          reasons.push('Mots-clés titre/texte');
        }
      }
    }

    if (parsed.typeHint === 'OHADA' && (d.juridiction === 'OHADA' || (d.categorie ?? '').includes('OHADA'))) {
      score += 10;
    }

    // Ancre minimale : article, numéro, ou (à défaut) mots-clés forts
    const hasAnchor = articleOk || numeroOk;
    if (!hasAnchor) {
      if (score < 25) continue;
    } else if (score < 50) {
      continue;
    }

    scored.push({
      c,
      score: Math.min(100, score),
      reason: reasons.length ? `Référence exacte · ${reasons.join(' · ')}` : 'Référence exacte',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => toHit(s.c, s.score, s.reason, 'exact'));
}

export function searchLocalLexical(
  query: string,
  filters?: SearchFilters,
  limit = 12
): SearchHit[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const all = loadLocalChunks().filter((c) => passesFilters(c, filters));
  const scored: { c: LocalChunk; score: number }[] = [];

  for (const c of all) {
    let hit = 0;
    let weight = 0;
    for (const t of tokens) {
      if (c.haystack.includes(t)) {
        hit += 1;
        // Bonus titre / article
        const titleHay = normalizeText(
          `${c.document.titre} ${c.articleLabel ?? ''} ${c.document.numero ?? ''}`
        );
        weight += titleHay.includes(t) ? 2.5 : 1;
      }
    }
    if (hit === 0) continue;
    const coverage = hit / tokens.length;
    const score = Math.min(1, coverage * 0.55 + (weight / (tokens.length * 2.5)) * 0.45);
    if (score < 0.15) continue;
    scored.push({ c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, limit)
    .map((s) => toHit(s.c, s.score, 'Correspondance lexicale', 'lexical'));
}

/**
 * Mode sémantique sans embeddings : lexical renforcé (dégradé honnête).
 */
export function searchLocalSemanticFallback(
  query: string,
  filters?: SearchFilters,
  limit = 12
): SearchHit[] {
  return searchLocalLexical(query, filters, limit).map((h) => ({
    ...h,
    matchReason: 'Similarité approximative (mode local sans embeddings)',
  }));
}
