import { z } from 'zod';

/** Types de relation juridique (CDC LegalRelation). */
export const LegalRelationTypeSchema = z.enum([
  'abrogates',
  'amends',
  'refers_to',
  'implements',
  'supersedes',
  'consolidates',
  'conflicts_with',
  'cites',
]);
export type LegalRelationType = z.infer<typeof LegalRelationTypeSchema>;

export const LegalConfidenceSchema = z.enum(['verified', 'probable', 'unknown']);
export type LegalConfidence = z.infer<typeof LegalConfidenceSchema>;

export const LegalRelationSchema = z.object({
  id: z.string().uuid().optional(),
  fromDocumentId: z.string().uuid(),
  toDocumentId: z.string().uuid(),
  relationType: LegalRelationTypeSchema,
  fromArticle: z.string().trim().max(40).nullable().optional(),
  toArticle: z.string().trim().max(40).nullable().optional(),
  confidence: LegalConfidenceSchema.default('unknown'),
  justification: z.string().trim().max(2000).nullable().optional(),
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
});
export type LegalRelation = z.infer<typeof LegalRelationSchema>;

export const LegalDocumentVersionSchema = z.object({
  id: z.string().uuid().optional(),
  documentFamilyId: z.string().uuid(),
  documentId: z.string().uuid().nullable().optional(),
  versionLabel: z.string().trim().min(1).max(120),
  effectiveFrom: z.string().nullable().optional(), // ISO date
  effectiveTo: z.string().nullable().optional(),
  isConsolidated: z.boolean().default(false),
  sourcePath: z.string().nullable().optional(),
  sha256: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type LegalDocumentVersion = z.infer<typeof LegalDocumentVersionSchema>;

export const LegalArticleVersionSchema = z.object({
  id: z.number().int().optional(),
  documentId: z.string().uuid(),
  articleNum: z.string().trim().min(1).max(40),
  articleLabel: z.string().trim().max(80).nullable().optional(),
  contenu: z.string().min(1),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  chunkId: z.number().int().nullable().optional(),
});
export type LegalArticleVersion = z.infer<typeof LegalArticleVersionSchema>;

/** Libellés FR pour l’UI. */
export const LEGAL_RELATION_LABELS: Record<LegalRelationType, string> = {
  abrogates: 'Abroge',
  amends: 'Modifie',
  refers_to: 'Renvoie à',
  implements: 'Met en œuvre',
  supersedes: 'Remplace',
  consolidates: 'Consolide',
  conflicts_with: 'En conflit avec',
  cites: 'Cite',
};
