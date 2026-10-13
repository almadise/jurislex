import { z } from 'zod';

export const HumanReviewLevelSchema = z.enum(['none', 'recommended', 'required']);
export type HumanReviewLevel = z.infer<typeof HumanReviewLevelSchema>;

export const TemplateFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  helper: z.string().optional(),
  required: z.boolean().default(true),
  rows: z.number().int().optional(),
  type: z.enum(['text', 'textarea', 'date', 'amount']).default('text'),
});

export const DocumentTemplateSchema = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  domain: z.string(),
  estimatedTime: z.string(),
  humanReviewLevel: HumanReviewLevelSchema,
  conditions: z.string(),
  fields: z.array(TemplateFieldSchema),
  structure: z.array(z.string()),
  mandatoryClauses: z.array(z.string()),
  optionalClauses: z.array(z.string()).optional().default([]),
  attachments: z.array(z.string()).optional().default([]),
  legalBasis: z.array(z.string()),
  blockingReasons: z.array(z.string()).optional().default([]),
  bodyTemplate: z.string(),
});
/** Type d'écriture des modèles (defaults Zod appliqués à l'exécution). */
export type DocumentTemplateDef = z.input<typeof DocumentTemplateSchema> & {
  optionalClauses?: string[];
  attachments?: string[];
  blockingReasons?: string[];
};

export const GenerateDocumentRequestSchema = z.object({
  templateId: z.string().min(1),
  fields: z.record(z.string(), z.string()),
  matterId: z.string().optional().nullable(),
  lieu: z.string().optional(),
  dateDocument: z.string().optional(),
  confirmProfessionalReview: z.boolean().optional(),
});
export type GenerateDocumentRequest = z.infer<typeof GenerateDocumentRequestSchema>;

export const GeneratedDocumentSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  templateVersion: z.string(),
  title: z.string(),
  body: z.string(),
  fields: z.record(z.string(), z.string()),
  legalBasis: z.array(z.string()),
  attachments: z.array(z.string()),
  humanReviewLevel: HumanReviewLevelSchema,
  warnings: z.array(z.string()),
  unresolvedPlaceholders: z.array(z.string()),
  blocked: z.boolean(),
  blockReason: z.string().optional(),
  watermark: z.string().optional(),
  matterId: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type GeneratedDocument = z.infer<typeof GeneratedDocumentSchema>;

export const ExportDocumentRequestSchema = z.object({
  templateId: z.string(),
  fields: z.record(z.string(), z.string()),
  format: z.enum(['docx', 'pdf']),
  lieu: z.string().optional(),
  dateDocument: z.string().optional(),
  confirmProfessionalReview: z.boolean().optional(),
  matterId: z.string().optional().nullable(),
});
