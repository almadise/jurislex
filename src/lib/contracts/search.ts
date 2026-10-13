import { z } from 'zod';

/** Modes de recherche CDC §4.1 — exacte prioritaire et déterministe. */
export const SearchModeSchema = z.enum(['exact', 'lexical', 'semantic', 'hybrid']);
export type SearchMode = z.infer<typeof SearchModeSchema>;

export const ProvenanceSchema = z.enum(['official', 'secondary', 'unknown']);
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** Statut juridique prudent — jamais « en vigueur » sans preuve. */
export const LegalStatusSchema = z.enum([
  'verified',
  'probable',
  'unknown',
  'repealed',
  'superseded',
]);
export type LegalStatus = z.infer<typeof LegalStatusSchema>;

export const SearchFiltersSchema = z.object({
  /** Catégorie corpus (ex. 18_Securite_sociale, 02_Droit_OHADA). */
  categories: z.array(z.string()).optional(),
  /** Juridiction / autorité (Cameroun, OHADA, COBAC…). */
  jurisdictions: z.array(z.string()).optional(),
  /** Type d'acte (Loi, Décret, Ordonnance…). */
  types: z.array(z.string()).optional(),
  provenance: z.array(ProvenanceSchema).optional(),
  legalStatuses: z.array(LegalStatusSchema).optional(),
  languages: z.array(z.string()).optional(),
  yearFrom: z.number().int().min(1800).max(2100).optional(),
  yearTo: z.number().int().min(1800).max(2100).optional(),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  mode: SearchModeSchema.default('hybrid'),
  filters: SearchFiltersSchema.optional(),
  limit: z.number().int().min(1).max(50).default(12),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchHitSchema = z.object({
  id: z.string(),
  chunkId: z.union([z.string(), z.number()]).nullable(),
  documentId: z.string().nullable(),
  title: z.string(),
  reference: z.string(),
  article: z.string(),
  articleNum: z.string().nullable(),
  excerpt: z.string(),
  page: z.number().nullable(),
  pageEnd: z.number().nullable(),
  domain: z.string(),
  category: z.string().nullable(),
  authority: z.string(),
  jurisdiction: z.string().nullable(),
  typeActe: z.string().nullable(),
  numero: z.string().nullable(),
  date: z.string().nullable(),
  provenance: ProvenanceSchema,
  legalStatus: LegalStatusSchema,
  matchScore: z.number(),
  matchReason: z.string(),
  language: z.string(),
  sourcePath: z.string().nullable(),
  backend: z.enum(['supabase', 'local']),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const SearchResponseSchema = z.object({
  mode: SearchModeSchema,
  effectiveMode: z.string(),
  backend: z.enum(['supabase', 'local', 'none']),
  query: z.string(),
  resultats: z.array(SearchHitSchema),
  total: z.number().int(),
  warnings: z.array(z.string()).default([]),
  corpus: z
    .object({
      documents: z.number().int().optional(),
      chunks: z.number().int().optional(),
      source: z.string().optional(),
    })
    .optional(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
