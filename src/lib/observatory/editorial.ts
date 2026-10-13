/**
 * File éditoriale observatoire (C2c).
 * Store local build/editorial-queue.json (+ miroir SQL migration 005 en prod).
 */

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type EditorialItemType =
  | 'document'
  | 'relation'
  | 'chunk'
  | 'rule'
  | 'source_update';

export type EditorialStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'quarantined';

export interface EditorialAction {
  id: string;
  at: string;
  byUserId: string | null;
  byEmail?: string | null;
  action: 'create' | 'assign' | 'approve' | 'reject' | 'quarantine' | 'request_info' | 'note';
  note?: string | null;
}

export interface EditorialItem {
  id: string;
  itemType: EditorialItemType;
  status: EditorialStatus;
  title: string;
  sourcePath?: string | null;
  documentSlug?: string | null;
  relationId?: string | null;
  ruleId?: string | null;
  assigneeId?: string | null;
  assigneeEmail?: string | null;
  priority: number;
  checklist: {
    provenanceChecked: boolean;
    legalStatusChecked: boolean;
    relationsChecked: boolean;
    qualityChecked: boolean;
  };
  notes: string[];
  actions: EditorialAction[];
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

interface Store {
  items: EditorialItem[];
}

function storePath(): string {
  return (
    process.env.JURISLEX_EDITORIAL_PATH ||
    join(process.cwd(), 'build', 'editorial-queue.json')
  );
}

function readStore(): Store {
  const p = storePath();
  if (!existsSync(p)) return { items: [] };
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Store;
  } catch {
    return { items: [] };
  }
}

function writeStore(data: Store): void {
  const p = storePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

export function listEditorialItems(filter?: {
  status?: EditorialStatus;
  limit?: number;
}): EditorialItem[] {
  let items = readStore().items.slice();
  if (filter?.status) items = items.filter((i) => i.status === filter.status);
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items.slice(0, filter?.limit ?? 100);
}

export function getEditorialItem(id: string): EditorialItem | null {
  return readStore().items.find((i) => i.id === id) ?? null;
}

export function createEditorialItem(input: {
  itemType: EditorialItemType;
  title: string;
  sourcePath?: string | null;
  documentSlug?: string | null;
  relationId?: string | null;
  ruleId?: string | null;
  priority?: number;
  createdBy: string | null;
  note?: string;
}): EditorialItem {
  const now = new Date().toISOString();
  const item: EditorialItem = {
    id: randomUUID(),
    itemType: input.itemType,
    status: 'pending',
    title: input.title,
    sourcePath: input.sourcePath ?? null,
    documentSlug: input.documentSlug ?? null,
    relationId: input.relationId ?? null,
    ruleId: input.ruleId ?? null,
    assigneeId: null,
    assigneeEmail: null,
    priority: input.priority ?? 100,
    checklist: {
      provenanceChecked: false,
      legalStatusChecked: false,
      relationsChecked: false,
      qualityChecked: false,
    },
    notes: input.note ? [input.note] : [],
    actions: [
      {
        id: randomUUID(),
        at: now,
        byUserId: input.createdBy,
        action: 'create',
        note: input.note ?? null,
      },
    ],
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };
  const data = readStore();
  data.items.push(item);
  writeStore(data);
  return item;
}

export function updateEditorialItem(
  id: string,
  patch: {
    status?: EditorialStatus;
    assigneeId?: string | null;
    assigneeEmail?: string | null;
    checklist?: Partial<EditorialItem['checklist']>;
    note?: string;
    action: EditorialAction['action'];
    byUserId: string | null;
    byEmail?: string | null;
  }
): EditorialItem | null {
  const data = readStore();
  const idx = data.items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const item = data.items[idx];
  const now = new Date().toISOString();

  if (patch.status) item.status = patch.status;
  if (patch.assigneeId !== undefined) item.assigneeId = patch.assigneeId;
  if (patch.assigneeEmail !== undefined) item.assigneeEmail = patch.assigneeEmail;
  if (patch.checklist) item.checklist = { ...item.checklist, ...patch.checklist };
  if (patch.note) item.notes.push(patch.note);

  item.actions.push({
    id: randomUUID(),
    at: now,
    byUserId: patch.byUserId,
    byEmail: patch.byEmail,
    action: patch.action,
    note: patch.note ?? null,
  });
  item.updatedAt = now;
  data.items[idx] = item;
  writeStore(data);
  return item;
}

/** Crée des items « source_update » pour chemins modifiés/nouveaux non déjà en file. */
export function enqueueFromObservatory(
  paths: { sourcePath: string; status: string }[],
  createdBy: string | null
): EditorialItem[] {
  const existing = new Set(
    listEditorialItems()
      .filter((i) => i.status === 'pending' || i.status === 'in_review' || i.status === 'quarantined')
      .map((i) => i.sourcePath)
      .filter(Boolean)
  );
  const created: EditorialItem[] = [];
  for (const p of paths) {
    if (existing.has(p.sourcePath)) continue;
    if (!['modified', 'new', 'missing'].includes(p.status)) continue;
    created.push(
      createEditorialItem({
        itemType: 'source_update',
        title: `[${p.status}] ${p.sourcePath}`,
        sourcePath: p.sourcePath,
        createdBy,
        note: `Import observatoire — statut disque: ${p.status}`,
        priority: p.status === 'modified' ? 10 : 50,
      })
    );
  }
  return created;
}
