import { z } from 'zod';

export const ClarificationQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  impact: z.string(),
  required: z.boolean(),
  /** qualification | competence | delai | preuve | document */
  category: z.enum(['qualification', 'competence', 'delai', 'preuve', 'document']),
});
export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;

export const FactObjectSchema = z.object({
  parties: z.array(
    z.object({
      name: z.string(),
      quality: z.string(),
    })
  ),
  jurisdiction: z.string(),
  dates: z.array(z.object({ label: z.string(), date: z.string() })),
  legalRelation: z.string(),
  admittedFacts: z.array(z.string()),
  disputedFacts: z.array(z.string()),
  amounts: z.array(z.object({ label: z.string(), amount: z.string() })),
  objective: z.string(),
  legalIssues: z.array(z.string()),
  missingInfo: z.array(z.string()),
  urgencies: z.array(z.string()),
  confidenceLevel: z.number().min(0).max(100),
  /** Faits utilisateur vs hypothèses système */
  hypotheses: z.array(z.string()).default([]),
  domainGuess: z.string().optional(),
});
export type FactObject = z.infer<typeof FactObjectSchema>;

export const DeterministicCalcSchema = z.object({
  id: z.string(),
  label: z.string(),
  result: z.string(),
  unit: z.string().optional(),
  formula: z.string(),
  assumptions: z.array(z.string()),
  legalReferences: z.array(z.string()),
  status: z.enum(['computed', 'blocked_missing_input', 'hypothesis_only']),
  /** C2a — ancrage registre (verified | hypothesis_only | provisional) */
  ruleStatus: z.enum(['verified', 'hypothesis_only', 'provisional']).optional(),
  sourcePaths: z.array(z.string()).optional(),
  articles: z.array(z.string()).optional(),
});
export type DeterministicCalc = z.infer<typeof DeterministicCalcSchema>;

export const StructuredAnalysisSchema = z.object({
  id: z.string().optional(),
  factObject: FactObjectSchema,
  applicableLaw: z.array(
    z.object({
      reference: z.string(),
      article: z.string(),
      relevance: z.string(),
      sourceId: z.string().optional(),
      page: z.number().nullable().optional(),
      excerpt: z.string().optional(),
      verified: z.boolean().default(true),
    })
  ),
  qualification: z.string(),
  risks: z.array(
    z.object({
      level: z.enum(['low', 'medium', 'high']),
      description: z.string(),
    })
  ),
  evidence: z.array(
    z.object({
      item: z.string(),
      status: z.enum(['available', 'to_gather', 'missing']),
    })
  ),
  nextSteps: z.array(
    z.object({
      priority: z.number(),
      action: z.string(),
      deadline: z.string().optional(),
    })
  ),
  overallRisk: z.enum(['low', 'medium', 'high']),
  confidenceLevel: z.number().min(0).max(100),
  calculations: z.array(DeterministicCalcSchema).default([]),
  userFacts: z.array(z.string()).default([]),
  systemHypotheses: z.array(z.string()).default([]),
  warningMessage: z.string(),
  matterId: z.string().nullable().optional(),
  engine: z.enum(['rules', 'llm+rules']).default('rules'),
});
export type StructuredAnalysis = z.infer<typeof StructuredAnalysisSchema>;

export const ExtractFactsRequestSchema = z.object({
  narrative: z.string().trim().min(20).max(12000),
  matterId: z.string().min(1).max(80).optional().nullable(),
});

export const AnalyzeRequestSchema = z.object({
  narrative: z.string().trim().min(20).max(12000),
  factObject: FactObjectSchema.optional(),
  answers: z.record(z.string(), z.string()).default({}),
  matterId: z.string().min(1).max(80).optional().nullable(),
  skipClarification: z.boolean().default(false),
});
