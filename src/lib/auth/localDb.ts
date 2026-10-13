import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { AuditEvent, AuthUser, MatterRecord, UserRole } from '@/lib/contracts/matter';
import { hashPassword, verifyPassword } from './crypto';

interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  barreauNumber?: string | null;
  orgId?: string | null;
  createdAt: string;
}

export interface StoredAnalysis {
  id: string;
  ownerId: string;
  matterId: string | null;
  narrative: string;
  analysis: unknown;
  createdAt: string;
}

export interface StoredGeneratedDocument {
  id: string;
  ownerId: string;
  matterId: string | null;
  templateId: string;
  title: string;
  format?: string;
  document: unknown;
  createdAt: string;
}

interface LocalDb {
  users: LocalUser[];
  matters: MatterRecord[];
  audit: AuditEvent[];
  analyses: StoredAnalysis[];
  documents: StoredGeneratedDocument[];
}

const DB_PATH = () =>
  path.join(process.cwd(), process.env.JURISLEX_LOCAL_DB || 'build/local-db.json');

function emptyDb(): LocalDb {
  return { users: [], matters: [], audit: [], analyses: [], documents: [] };
}

function readDb(): LocalDb {
  const p = DB_PATH();
  try {
    if (!fs.existsSync(p)) return emptyDb();
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw) as LocalDb;
    return {
      users: data.users ?? [],
      matters: data.matters ?? [],
      audit: data.audit ?? [],
      analyses: data.analyses ?? [],
      documents: data.documents ?? [],
    };
  } catch {
    return emptyDb();
  }
}

function writeDb(db: LocalDb): void {
  const p = DB_PATH();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // écriture atomique simple
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function toAuthUser(u: LocalUser): AuthUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    barreauNumber: u.barreauNumber,
    orgId: u.orgId,
    backend: 'local',
  };
}

export function localSignup(input: {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  barreauNumber?: string;
}): AuthUser {
  const db = readDb();
  const email = input.email.toLowerCase().trim();
  if (db.users.some((u) => u.email === email)) {
    throw new Error('Un compte existe déjà avec cet e-mail.');
  }
  // Inscription publique : toujours standard, sauf bootstrap premier compte → admin.
  // Toute valeur client (reviewer/admin) est ignorée après le bootstrap.
  let role: UserRole = 'standard';
  if (db.users.length === 0) {
    role = 'admin';
  }
  const user: LocalUser = {
    id: randomUUID(),
    email,
    passwordHash: hashPassword(input.password),
    fullName: input.fullName.trim(),
    role,
    barreauNumber: input.barreauNumber ?? null,
    orgId: null,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDb(db);
  appendAudit(user.id, 'auth.signup', 'user', user.id, { role: user.role });
  return toAuthUser(user);
}

export function localLogin(email: string, password: string): AuthUser {
  const db = readDb();
  const user = db.users.find((u) => u.email === email.toLowerCase().trim());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error('Identifiants invalides.');
  }
  appendAudit(user.id, 'auth.login', 'user', user.id, {});
  return toAuthUser(user);
}

export function localGetUser(id: string): AuthUser | null {
  const db = readDb();
  const user = db.users.find((u) => u.id === id);
  return user ? toAuthUser(user) : null;
}

export function localListMatters(ownerId: string): MatterRecord[] {
  const db = readDb();
  return db.matters
    .filter((m) => m.ownerId === ownerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function localGetMatter(id: string, ownerId: string): MatterRecord | null {
  const db = readDb();
  const m = db.matters.find((x) => x.id === id);
  if (!m) return null;
  if (m.ownerId !== ownerId) {
    appendAudit(ownerId, 'matter.access_denied', 'matter', id, {});
    return null;
  }
  return m;
}

export function localCreateMatter(
  owner: AuthUser,
  data: {
    title: string;
    domain: string;
    parties: { name: string; quality?: string; contact?: string }[];
    riskLevel: 'low' | 'medium' | 'high';
    tags: string[];
    status?: MatterRecord['status'];
  }
): MatterRecord {
  const db = readDb();
  const year = new Date().getFullYear();
  const seq = db.matters.filter((m) => m.ownerId === owner.id).length + 1;
  const reference = `DOS-${year}-${String(seq).padStart(4, '0')}`;
  const now = new Date().toISOString();
  const matter: MatterRecord = {
    id: randomUUID(),
    ownerId: owner.id,
    orgId: owner.orgId ?? null,
    reference,
    title: data.title,
    domain: data.domain,
    status: data.status ?? 'draft',
    riskLevel: data.riskLevel,
    tags: data.tags,
    parties: data.parties,
    analysesCount: 0,
    documentsCount: 0,
    assignedTo: owner.fullName,
    createdAt: now,
    updatedAt: now,
  };
  db.matters.push(matter);
  writeDb(db);
  appendAudit(owner.id, 'matter.create', 'matter', matter.id, {
    reference: matter.reference,
    domain: matter.domain,
  });
  return matter;
}

export function localUpdateMatter(
  id: string,
  ownerId: string,
  patch: Partial<
    Pick<MatterRecord, 'title' | 'domain' | 'status' | 'riskLevel' | 'tags' | 'parties'>
  >
): MatterRecord | null {
  const db = readDb();
  const idx = db.matters.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  if (db.matters[idx].ownerId !== ownerId) {
    appendAudit(ownerId, 'matter.access_denied', 'matter', id, { action: 'update' });
    return null;
  }
  const next = {
    ...db.matters[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  db.matters[idx] = next;
  writeDb(db);
  appendAudit(ownerId, 'matter.update', 'matter', id, {
    fields: Object.keys(patch),
  });
  return next;
}

export function localDeleteMatter(id: string, ownerId: string): boolean {
  const db = readDb();
  const m = db.matters.find((x) => x.id === id);
  if (!m) return false;
  if (m.ownerId !== ownerId) {
    appendAudit(ownerId, 'matter.access_denied', 'matter', id, { action: 'delete' });
    return false;
  }
  db.matters = db.matters.filter((x) => x.id !== id);
  writeDb(db);
  appendAudit(ownerId, 'matter.delete', 'matter', id, { reference: m.reference });
  return true;
}

export function localExportMatter(id: string, ownerId: string): MatterRecord | null {
  const m = localGetMatter(id, ownerId);
  if (m) appendAudit(ownerId, 'matter.export', 'matter', id, { reference: m.reference });
  return m;
}

function appendAudit(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  meta: Record<string, unknown>
): void {
  const db = readDb();
  db.audit.push({
    id: randomUUID(),
    userId,
    action,
    resourceType,
    resourceId,
    meta: sanitizeMeta(meta),
    createdAt: new Date().toISOString(),
  });
  // garder les 5000 derniers
  if (db.audit.length > 5000) db.audit = db.audit.slice(-5000);
  writeDb(db);
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (key.includes('password') || key.includes('secret') || key.includes('token')) continue;
    if (typeof v === 'string' && v.includes('@')) {
      out[k] = '[redacted-email]';
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function localListAudit(userId: string, limit = 50): AuditEvent[] {
  const db = readDb();
  return db.audit
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Accès forcé hors isolation — uniquement pour tests d'isolation (doit échouer). */
export function localMatterExists(id: string): boolean {
  return readDb().matters.some((m) => m.id === id);
}

export function localSaveAnalysis(input: {
  ownerId: string;
  matterId: string | null;
  narrative: string;
  analysis: unknown;
  analysisId?: string;
}): StoredAnalysis {
  const db = readDb();
  if (input.matterId) {
    const m = db.matters.find((x) => x.id === input.matterId);
    if (!m || m.ownerId !== input.ownerId) {
      appendAudit(input.ownerId, 'analysis.access_denied', 'matter', input.matterId, {});
      throw new Error('Dossier introuvable ou accès refusé pour rattacher l’analyse.');
    }
    m.analysesCount += 1;
    m.updatedAt = new Date().toISOString();
    if (m.status === 'draft') m.status = 'analysis';
  }
  const row: StoredAnalysis = {
    id: input.analysisId || randomUUID(),
    ownerId: input.ownerId,
    matterId: input.matterId,
    narrative: input.narrative.slice(0, 8000),
    analysis: input.analysis,
    createdAt: new Date().toISOString(),
  };
  db.analyses.push(row);
  if (db.analyses.length > 2000) db.analyses = db.analyses.slice(-2000);
  writeDb(db);
  appendAudit(input.ownerId, 'analysis.create', 'analysis', row.id, {
    matterId: input.matterId,
  });
  return row;
}

export function localListAnalyses(ownerId: string, matterId?: string): StoredAnalysis[] {
  const db = readDb();
  return db.analyses
    .filter((a) => a.ownerId === ownerId && (!matterId || a.matterId === matterId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function localSaveGeneratedDocument(input: {
  ownerId: string;
  matterId: string | null;
  document: { id: string; templateId: string; title: string };
  format?: string;
}): StoredGeneratedDocument {
  const db = readDb();
  if (input.matterId) {
    const m = db.matters.find((x) => x.id === input.matterId);
    if (!m || m.ownerId !== input.ownerId) {
      appendAudit(input.ownerId, 'document.access_denied', 'matter', input.matterId, {});
      throw new Error('Dossier introuvable ou accès refusé.');
    }
    m.documentsCount += 1;
    m.updatedAt = new Date().toISOString();
    if (m.status === 'analysis' || m.status === 'active' || m.status === 'draft') {
      m.status = 'documented';
    }
  }
  const row: StoredGeneratedDocument = {
    id: input.document.id,
    ownerId: input.ownerId,
    matterId: input.matterId,
    templateId: input.document.templateId,
    title: input.document.title,
    format: input.format,
    document: input.document,
    createdAt: new Date().toISOString(),
  };
  db.documents.push(row);
  if (db.documents.length > 1000) db.documents = db.documents.slice(-1000);
  writeDb(db);
  appendAudit(input.ownerId, 'document.generate', 'document', row.id, {
    templateId: row.templateId,
    format: input.format ?? 'preview',
  });
  return row;
}
