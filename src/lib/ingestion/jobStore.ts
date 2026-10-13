/**
 * Store de jobs d'ingestion C1.
 * - Fichier local build/ingestion-jobs.json (dev / sans Redis)
 * - Enqueue Redis (worker) si REDIS_URL configuré
 */

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type {
  CreateIngestionJobInput,
  IngestionJobRecord,
  IngestionJobStatus,
} from '@/lib/contracts/ingestion';

const REDIS_QUEUE = process.env.JURISLEX_INGESTION_QUEUE || 'jurislex:ingestion:jobs';

function jobsPath(): string {
  return (
    process.env.JURISLEX_INGESTION_JOBS_PATH ||
    join(process.cwd(), 'build', 'ingestion-jobs.json')
  );
}

interface JobsFile {
  jobs: IngestionJobRecord[];
}

function readJobs(): JobsFile {
  const p = jobsPath();
  if (!existsSync(p)) return { jobs: [] };
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as JobsFile;
  } catch {
    return { jobs: [] };
  }
}

function writeJobs(data: JobsFile): void {
  const p = jobsPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

export function listIngestionJobs(limit = 50): IngestionJobRecord[] {
  const { jobs } = readJobs();
  return jobs
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getIngestionJob(id: string): IngestionJobRecord | null {
  return readJobs().jobs.find((j) => j.id === id) ?? null;
}

export function updateIngestionJob(
  id: string,
  patch: Partial<
    Pick<
      IngestionJobRecord,
      'status' | 'progress' | 'result' | 'error' | 'startedAt' | 'finishedAt'
    >
  >
): IngestionJobRecord | null {
  const data = readJobs();
  const idx = data.jobs.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  data.jobs[idx] = { ...data.jobs[idx], ...patch };
  writeJobs(data);
  return data.jobs[idx];
}

async function enqueueRedis(job: IngestionJobRecord): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) return false;
  try {
    // Import dynamique pour ne pas imposer redis en dev sans worker
    const { createClient } = await import('redis');
    const client = createClient({ url });
    await client.connect();
    await client.lPush(REDIS_QUEUE, JSON.stringify({ id: job.id, jobType: job.jobType }));
    await client.quit();
    return true;
  } catch (e) {
    console.warn('[ingestion] Redis enqueue failed, job reste en fichier local:', (e as Error).message);
    return false;
  }
}

export async function createIngestionJob(
  input: CreateIngestionJobInput,
  createdBy: string | null
): Promise<IngestionJobRecord> {
  const now = new Date().toISOString();
  const job: IngestionJobRecord = {
    id: randomUUID(),
    jobType: input.jobType,
    status: 'queued' as IngestionJobStatus,
    priority: input.priority ?? 100,
    payload: input.payload ?? {},
    progress: {},
    result: null,
    error: null,
    createdBy,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
  };

  const data = readJobs();
  data.jobs.push(job);
  writeJobs(data);

  await enqueueRedis(job);
  return job;
}

export function isIngestionAdmin(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'reviewer';
}
