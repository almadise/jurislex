import { z } from 'zod';

export const IngestionJobTypeSchema = z.enum([
  'verify',
  'ocr',
  'extract',
  'upload',
  'pipeline',
  'quality',
]);
export type IngestionJobType = z.infer<typeof IngestionJobTypeSchema>;

export const IngestionJobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export type IngestionJobStatus = z.infer<typeof IngestionJobStatusSchema>;

export const CreateIngestionJobSchema = z.object({
  jobType: IngestionJobTypeSchema,
  payload: z
    .object({
      /** Chemin relatif sous legal-content/ (optionnel pour extract/upload global). */
      sourcePath: z.string().trim().max(500).optional(),
      /** Budget OCR en secondes. */
      budgetSeconds: z.number().int().positive().max(86_400).optional(),
      /** Seuil de quarantaine qualité (0–100). */
      qualityThreshold: z.number().min(0).max(100).optional(),
      /** Dry-run (pas d’écriture destructive). */
      dryRun: z.boolean().optional(),
      /** Étapes pipeline si jobType = pipeline. */
      steps: z
        .array(z.enum(['verify', 'ocr', 'extract', 'quality', 'upload']))
        .optional(),
    })
    .default({}),
  priority: z.number().int().min(0).max(1000).default(100),
});
export type CreateIngestionJobInput = z.infer<typeof CreateIngestionJobSchema>;

export const QualityFlagSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string(),
});
export type QualityFlag = z.infer<typeof QualityFlagSchema>;

export const QualityReportSchema = z.object({
  sourcePath: z.string(),
  documentSlug: z.string().nullable().optional(),
  score: z.number().min(0).max(100),
  flags: z.array(QualityFlagSchema).default([]),
  metrics: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
  quarantined: z.boolean().default(false),
});
export type QualityReport = z.infer<typeof QualityReportSchema>;

export interface IngestionJobRecord {
  id: string;
  jobType: IngestionJobType;
  status: IngestionJobStatus;
  priority: number;
  payload: Record<string, unknown>;
  progress: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
