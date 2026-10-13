import { getSupabase } from './supabase';
import type { SearchHit } from '@/lib/contracts/search';
import {
  buildReference,
  domainFromCategory,
  formatDateFr,
  inferProvenance,
  mapLegalStatus,
  scoreToPercent,
} from '@/lib/search/normalize';

/**
 * Accès client à la base légale (lecture seule via clé anon).
 * La recherche principale passe par POST /api/recherche-legale (serveur)
 * pour ne jamais exposer OPENAI_API_KEY.
 */

export type Juridiction =
  | 'Cameroun'
  | 'OHADA'
  | 'CEMAC'
  | 'COBAC'
  | 'CIMA'
  | 'OAPI'
  | 'UDEAC';

export interface ResultatLegal {
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
}

export interface OptionsRecherche {
  limite?: number;
  juridiction?: Juridiction;
  categorie?: string;
}

export async function rechercheBaseLegale(
  question: string,
  embedding: number[],
  options: OptionsRecherche = {}
): Promise<ResultatLegal[]> {
  if (embedding.length !== 1536) {
    throw new Error(
      `Embedding de dimension ${embedding.length}, attendu 1536 (text-embedding-3-small).`
    );
  }

  const { data, error } = await getSupabase().rpc('search_legal_base', {
    query_text: question,
    query_embedding: embedding,
    match_count: options.limite ?? 12,
    filtre_juridiction: options.juridiction ?? null,
    filtre_categorie: options.categorie ?? null,
  });

  if (error) throw new Error(`Recherche base légale : ${error.message}`);
  return (data ?? []) as ResultatLegal[];
}

/** Recherche plein texte seule — pas d'embedding requis. */
export async function rechercheTexteSeul(
  question: string,
  options: OptionsRecherche = {}
): Promise<ResultatLegal[]> {
  let q = getSupabase()
    .from('legal_chunks')
    .select(
      'id, contenu, article_label, page_debut, legal_documents!inner(id, titre, type_acte, numero, juridiction, categorie, source_path, statut)'
    )
    .textSearch('fts', question, { type: 'websearch', config: 'fr_unaccent' })
    .limit(options.limite ?? 12);

  if (options.juridiction) q = q.eq('legal_documents.juridiction', options.juridiction);
  if (options.categorie) q = q.eq('legal_documents.categorie', options.categorie);

  const { data, error } = await q;
  if (error) throw new Error(`Recherche plein texte : ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const doc = r.legal_documents as Record<string, unknown>;
    return {
      chunk_id: r.id as number,
      document_id: doc.id as string,
      titre: doc.titre as string,
      type_acte: (doc.type_acte as string) ?? null,
      numero: (doc.numero as string) ?? null,
      juridiction: (doc.juridiction as string) ?? null,
      categorie: (doc.categorie as string) ?? null,
      article_label: (r.article_label as string) ?? null,
      contenu: r.contenu as string,
      page_debut: (r.page_debut as number) ?? null,
      source_path: doc.source_path as string,
      score: 0,
    };
  });
}

export async function getArticle(numeroTexte: string, article: string) {
  const { data, error } = await getSupabase().rpc('get_article', {
    p_numero_texte: numeroTexte,
    p_article: article,
  });
  if (error) throw new Error(`Article introuvable : ${error.message}`);
  return data;
}

export function formaterCitation(r: ResultatLegal): string {
  const parties = [
    r.type_acte,
    r.numero ? `n° ${r.numero}` : null,
    r.titre,
    r.article_label,
    r.page_debut ? `p. ${r.page_debut}` : null,
  ].filter(Boolean);
  return parties.join(', ');
}

/** Convertit un hit RPC hybride en SearchHit (contrat S0). */
export function resultatToSearchHit(r: ResultatLegal): SearchHit {
  return {
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
    excerpt: r.contenu.slice(0, 480),
    page: r.page_debut,
    pageEnd: null,
    domain: domainFromCategory(r.categorie),
    category: r.categorie,
    authority: r.juridiction || '—',
    jurisdiction: r.juridiction,
    typeActe: r.type_acte,
    numero: r.numero,
    date: formatDateFr(null),
    provenance: inferProvenance(r.source_path, r.titre),
    legalStatus: mapLegalStatus(null, 'unknown'),
    matchScore: scoreToPercent(r.score || 0.02, 'rrf'),
    matchReason: 'Recherche hybride',
    language: 'fr',
    sourcePath: r.source_path,
    backend: 'supabase',
  };
}
