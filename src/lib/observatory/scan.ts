import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type ObservatoryStatus =
  | 'unchanged'
  | 'modified'
  | 'new'
  | 'missing'
  | 'quarantined';

export interface ObservatoryItem {
  sourcePath: string;
  status: ObservatoryStatus;
  indexedSha256: string | null;
  diskSha256: string | null;
  indexedAt?: string;
  reason?: string;
}

export interface ObservatoryReport {
  scannedAt: string;
  corpusRoot: string;
  indexPath: string;
  totals: Record<ObservatoryStatus, number>;
  items: ObservatoryItem[];
  quarantine: string[];
}

const QUARANTINE_FILE = () =>
  path.join(process.cwd(), 'build', 'observatory-quarantine.json');

function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function listPdfFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.') || name === '_ocr' || name === '_ecartes') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...listPdfFiles(full, base));
    else if (name.toLowerCase().endsWith('.pdf')) {
      out.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

function loadIndexedHashes(chunksPath: string): Map<string, { sha256: string }> {
  const map = new Map<string, { sha256: string }>();
  if (!fs.existsSync(chunksPath)) return map;
  const raw = fs.readFileSync(chunksPath, 'utf8');
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as {
        document?: { source_path?: string; sha256?: string };
      };
      const sp = o.document?.source_path;
      const sha = o.document?.sha256;
      if (sp && sha) map.set(sp.replace(/\\/g, '/'), { sha256: sha });
    } catch {
      /* skip */
    }
  }
  return map;
}

export function loadQuarantine(): string[] {
  try {
    const p = QUARANTINE_FILE();
    if (!fs.existsSync(p)) return [];
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as { paths?: string[] };
    return j.paths || [];
  } catch {
    return [];
  }
}

export function saveQuarantine(paths: string[]): void {
  const p = QUARANTINE_FILE();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    JSON.stringify({ updatedAt: new Date().toISOString(), paths }, null, 2),
    'utf8'
  );
}

/**
 * Compare le corpus disque (PDF) à l'index chunks.jsonl (SHA-256).
 * Les textes modifiés peuvent être mis en quarantaine (réponses/modèles affectés).
 */
export function scanObservatory(): ObservatoryReport {
  const corpusRoot = path.join(process.cwd(), 'legal-content');
  const indexPath =
    process.env.JURISLEX_CHUNKS_PATH || path.join(process.cwd(), 'build', 'chunks.jsonl');
  const absIndex = path.isAbsolute(indexPath)
    ? indexPath
    : path.join(process.cwd(), indexPath);

  const indexed = loadIndexedHashes(absIndex);
  const onDisk = listPdfFiles(corpusRoot);
  const quarantine = new Set(loadQuarantine());
  const items: ObservatoryItem[] = [];

  const diskSet = new Set(onDisk);

  for (const rel of onDisk) {
    const full = path.join(corpusRoot, rel);
    let diskSha: string | null = null;
    try {
      diskSha = sha256File(full);
    } catch {
      diskSha = null;
    }
    const idx = indexed.get(rel);
    let status: ObservatoryStatus;
    let reason: string | undefined;

    if (quarantine.has(rel)) {
      status = 'quarantined';
      reason = 'Mis en quarantaine manuellement ou suite à un diff';
    } else if (!idx) {
      status = 'new';
      reason = 'Présent sur disque, absent de l’index chunks.jsonl';
    } else if (diskSha && idx.sha256 && diskSha !== idx.sha256) {
      status = 'modified';
      reason = 'SHA-256 disque ≠ empreinte indexée — ré-ingestion recommandée';
    } else {
      status = 'unchanged';
    }

    items.push({
      sourcePath: rel,
      status,
      indexedSha256: idx?.sha256 ?? null,
      diskSha256: diskSha,
      reason,
    });
  }

  for (const [rel, idx] of indexed) {
    if (diskSet.has(rel)) continue;
    items.push({
      sourcePath: rel,
      status: quarantine.has(rel) ? 'quarantined' : 'missing',
      indexedSha256: idx.sha256,
      diskSha256: null,
      reason: 'Indexé mais fichier absent du corpus disque',
    });
  }

  const totals: Record<ObservatoryStatus, number> = {
    unchanged: 0,
    modified: 0,
    new: 0,
    missing: 0,
    quarantined: 0,
  };
  for (const it of items) totals[it.status] += 1;

  // Auto-proposer quarantaine des modified (ne force pas sauf save explicite)
  return {
    scannedAt: new Date().toISOString(),
    corpusRoot,
    indexPath: absIndex,
    totals,
    items: items.sort((a, b) => a.status.localeCompare(b.status) || a.sourcePath.localeCompare(b.sourcePath)),
    quarantine: [...quarantine],
  };
}

export function quarantinePaths(paths: string[], add = true): string[] {
  const set = new Set(loadQuarantine());
  for (const p of paths) {
    if (add) set.add(p.replace(/\\/g, '/'));
    else set.delete(p.replace(/\\/g, '/'));
  }
  const list = [...set];
  saveQuarantine(list);
  return list;
}

export function isSourceQuarantined(sourcePath: string | null | undefined): boolean {
  if (!sourcePath) return false;
  return loadQuarantine().includes(sourcePath.replace(/\\/g, '/'));
}
