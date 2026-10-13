import { z } from 'zod';
import { LegalStatusSchema, ProvenanceSchema, SearchFiltersSchema } from './search';

export const ClaimStatusSchema = z.enum([
  'supported',
  'inferred',
  'uncertain',
  'unsupported',
  'conflicting',
]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const QARequestSchema = z.object({
  question: z.string().trim().min(5).max(2000),
  filters: SearchFiltersSchema.optional(),
  /** Nombre max de dispositions récupérées pour fonder la réponse. */
  retrievalLimit: z.number().int().min(3).max(30).default(12),
  /** Force le mode abstention si score de retrieval trop bas. */
  minRetrievalScore: z.number().min(0).max(100).default(35),
});
export type QARequest = z.infer<typeof QARequestSchema>;

/** Proposition d'affirmation produite par le modèle (avant vérif). */
export const ModelClaimSchema = z.object({
  text: z.string(),
  status: ClaimStatusSchema,
  /** Identifiants de provisions récupérées uniquement (id des hits). */
  sourceIds: z.array(z.string()).default([]),
});
export type ModelClaim = z.infer<typeof ModelClaimSchema>;

export const ModelAnswerSchema = z.object({
  mode: z.enum(['answer', 'abstain']),
  summary: z.string(),
  legalRule: z.string(),
  application: z.string(),
  uncertainties: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
  missingTexts: z.array(z.string()).default([]),
  riskLevel: RiskLevelSchema,
  warningMessage: z.string(),
  claims: z.array(ModelClaimSchema).default([]),
  /** IDs de hits à citer (sous-ensemble des sources fournies). */
  citedSourceIds: z.array(z.string()).default([]),
  abstainReason: z.string().optional(),
});
export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;

export const QACitationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  chunkId: z.union([z.string(), z.number()]).nullable(),
  documentId: z.string().nullable(),
  reference: z.string(),
  article: z.string(),
  title: z.string(),
  excerpt: z.string(),
  page: z.number(),
  authority: stringOrDash(),
  legalStatus: LegalStatusSchema,
  claimStatus: ClaimStatusSchema,
  domain: z.string(),
  provenance: ProvenanceSchema.optional(),
  sourcePath: z.string().nullable().optional(),
  matchScore: z.number().optional(),
  verified: z.boolean(),
});

function stringOrDash() {
  return z.string();
}

export type QACitation = z.infer<typeof QACitationSchema>;

export const QAAssertionSchema = z.object({
  text: z.string(),
  status: ClaimStatusSchema,
  citationIds: z.array(z.string()).default([]),
});
export type QAAssertion = z.infer<typeof QAAssertionSchema>;

export const QAResponseSchema = z.object({
  question: z.string(),
  mode: z.enum(['answer', 'abstain']),
  summary: z.string(),
  legalRule: z.string(),
  application: z.string(),
  uncertainties: z.array(z.string()),
  conflicts: z.array(z.string()),
  riskLevel: RiskLevelSchema,
  warningMessage: z.string(),
  citations: z.array(QACitationSchema),
  missingTexts: z.array(z.string()),
  assertions: z.array(QAAssertionSchema).default([]),
  retrieval: z.object({
    backend: z.string(),
    effectiveMode: z.string(),
    hitCount: z.number().int(),
    warnings: z.array(z.string()).default([]),
  }),
  generation: z.object({
    engine: z.enum(['llm', 'extractive', 'none']),
    model: z.string().optional(),
    rejectedUnsupportedClaims: z.number().int().default(0),
    rejectedFakeCitations: z.number().int().default(0),
  }),
  warnings: z.array(z.string()).default([]),
});
export type QAResponse = z.infer<typeof QAResponseSchema>;
