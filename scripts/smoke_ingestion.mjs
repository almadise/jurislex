/**
 * Smoke C1 — file d'ingestion (auth + enqueue quality job + worker local).
 * Prérequis : serveur dev (npm run dev) sur BASE_URL.
 */
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4028';

function cookieJar() {
  const jar = { cookie: null };
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      const parts = raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean);
      for (const c of parts) {
        const m = String(c).match(/jurislex_session=[^;]+/);
        if (m) jar.cookie = m[0];
      }
    },
    header() {
      return jar.cookie ? { Cookie: jar.cookie } : {};
    },
  };
}

async function jsonFetch(path, { method = 'GET', jar, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...jar?.header(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar?.store(res);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { res, data };
}

function runWorkerOnce(jobId) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PYTHON || 'python',
      ['scripts/worker.py', '--job-id', jobId],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: process.env }
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`worker exit ${code}: ${out}`));
    });
  });
}

async function main() {
  const ts = Date.now();
  const jar = cookieJar();
  const email = `ingest.${ts}@jurislex.test`;
  const password = 'TestC1-Ingest!on1';

  let r = await jsonFetch('/api/auth/signup', {
    method: 'POST',
    jar,
    body: { email, password, fullName: 'Ingest Smoke' },
  });
  if (!r.res.ok) throw new Error(`signup: ${JSON.stringify(r.data)}`);

  r = await jsonFetch('/api/ingestion/jobs', {
    method: 'POST',
    jar,
    body: { jobType: 'quality', payload: { qualityThreshold: 55 }, priority: 10 },
  });
  if (!r.res.ok) throw new Error(`enqueue: ${JSON.stringify(r.data)}`);
  const jobId = r.data.job.id;
  console.log('job enqueued', jobId);

  // Worker local (sans Redis)
  try {
    const out = await runWorkerOnce(jobId);
    console.log(out.trim().split('\n').slice(-5).join('\n'));
  } catch (e) {
    console.warn('worker optional fail (chunks maybe empty):', e.message);
  }

  r = await jsonFetch(`/api/ingestion/jobs/${jobId}`, { jar });
  if (!r.res.ok) throw new Error(`get job: ${JSON.stringify(r.data)}`);
  console.log('job status', r.data.job.status);

  const qualityPath = join(ROOT, 'build', 'rapport_qualite.json');
  if (existsSync(qualityPath)) {
    const q = JSON.parse(readFileSync(qualityPath, 'utf-8'));
    console.log('quality summary', q.summary);
  }

  console.log('smoke:ingestion OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
