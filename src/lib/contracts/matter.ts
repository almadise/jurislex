import { z } from 'zod';

export const UserRoleSchema = z.enum(['standard', 'reviewer', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const MatterStatusSchema = z.enum([
  'draft',
  'active',
  'analysis',
  'documented',
  'closed',
  'archived',
]);
export type MatterStatus = z.infer<typeof MatterStatusSchema>;

export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);

export const PartyInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quality: z.string().trim().max(200).optional(),
  contact: z.string().trim().max(200).optional(),
});

export const CreateMatterSchema = z.object({
  title: z.string().trim().min(3).max(300),
  domain: z.string().trim().min(2).max(120),
  parties: z.array(PartyInputSchema).min(1).max(20),
  riskLevel: RiskLevelSchema.default('medium'),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  status: MatterStatusSchema.optional(),
});
export type CreateMatterInput = z.infer<typeof CreateMatterSchema>;

export const UpdateMatterSchema = z.object({
  title: z.string().trim().min(3).max(300).optional(),
  domain: z.string().trim().min(2).max(120).optional(),
  status: MatterStatusSchema.optional(),
  riskLevel: RiskLevelSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  parties: z.array(PartyInputSchema).min(1).max(20).optional(),
});
export type UpdateMatterInput = z.infer<typeof UpdateMatterSchema>;

export const SignupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
  /**
   * Ignoré côté serveur pour l’élévation : toujours `standard` à l’inscription
   * publique (sauf bootstrap local premier compte → admin). Conservé optionnel
   * pour compat clients anciens ; ne jamais faire confiance à cette valeur.
   */
  role: UserRoleSchema.optional(),
  barreauNumber: z.string().trim().max(80).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(128),
});

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  barreauNumber?: string | null;
  orgId?: string | null;
  backend: 'local' | 'supabase';
}

export interface MatterRecord {
  id: string;
  ownerId: string;
  orgId?: string | null;
  reference: string;
  title: string;
  domain: string;
  status: MatterStatus;
  riskLevel: 'low' | 'medium' | 'high';
  tags: string[];
  parties: { name: string; quality?: string; contact?: string }[];
  analysesCount: number;
  documentsCount: number;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}
