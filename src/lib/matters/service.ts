import type { AuthUser, CreateMatterInput, MatterRecord, UpdateMatterInput } from '@/lib/contracts/matter';
import {
  localCreateMatter,
  localDeleteMatter,
  localExportMatter,
  localGetMatter,
  localListMatters,
  localUpdateMatter,
} from '@/lib/auth/localDb';

/** Mappe vers le format UI historique. */
export function toUiMatter(m: MatterRecord) {
  return {
    id: m.id,
    reference: m.reference,
    title: m.title,
    domain: m.domain,
    parties: m.parties.map((p) => p.name),
    partyDetails: m.parties,
    status: m.status,
    analyses: m.analysesCount,
    documents: m.documentsCount,
    lastActivity: formatFr(m.updatedAt),
    createdAt: formatFr(m.createdAt),
    assignedTo: m.assignedTo,
    riskLevel: m.riskLevel,
    tags: m.tags,
    ownerId: m.ownerId,
  };
}

function formatFr(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR');
  } catch {
    return iso.slice(0, 10);
  }
}

export function listMattersForUser(user: AuthUser): MatterRecord[] {
  return localListMatters(user.id);
}

export function getMatterForUser(user: AuthUser, id: string): MatterRecord | null {
  return localGetMatter(id, user.id);
}

export function createMatterForUser(user: AuthUser, input: CreateMatterInput): MatterRecord {
  return localCreateMatter(user, {
    title: input.title,
    domain: input.domain,
    parties: input.parties,
    riskLevel: input.riskLevel ?? 'medium',
    tags: input.tags ?? [],
    status: input.status,
  });
}

export function updateMatterForUser(
  user: AuthUser,
  id: string,
  input: UpdateMatterInput
): MatterRecord | null {
  return localUpdateMatter(id, user.id, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.domain !== undefined ? { domain: input.domain } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.riskLevel !== undefined ? { riskLevel: input.riskLevel } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.parties !== undefined ? { parties: input.parties } : {}),
  });
}

export function deleteMatterForUser(user: AuthUser, id: string): boolean {
  return localDeleteMatter(id, user.id);
}

export function exportMatterForUser(user: AuthUser, id: string): MatterRecord | null {
  return localExportMatter(id, user.id);
}
