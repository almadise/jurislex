/**
 * JurisLex — runner d'évaluation versionné (CDC §12)
 * Usage: npm run eval
 * Prérequis: serveur dev sur JURISLEX_URL (défaut http://localhost:4028)
 *            et build/chunks.jsonl pour la recherche.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.JURISLEX_URL || 'http://localhost:4028';
const suitePath = path.join(__dirname, 'cases', 'v1', 'suite.json');
const outDir = path.join(__dirname, 'results');

function cookieJar() {
  let cookie = '';
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      const list = raw.length ? raw : res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : [];
      for (const c of list) {
        if (!c) continue;
        const part = c.split(';')[0];
        if (part.startsWith('jurislex_session=')) cookie = part;
      }
    },
    header() {
      return cookie ? { Cookie: cookie } : {};
    },
  };
}

async function api(pathname, { method = 'GET', body, jar } = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jar?.header() || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (jar) jar.store(res);
  const ct = res.headers.get('content-type') || '';
  let data = null;
  if (ct.includes('application/json')) data = await res.json();
  else data = { binary: true, size: Number(res.headers.get('content-length') || 0) };
  return { res, data, ms: Date.now() - t0 };
}

function pass(id, detail = '') {
  return { id, ok: true, detail };
}
function fail(id, detail) {
  return { id, ok: false, detail };
}

async function runCase(c) {
  switch (c.category) {
    case 'search_exact':
    case 'search_lexical':
    case 'search_semantic':
    case 'search_no_answer': {
      const { res, data, ms } = await api('/api/recherche-legale', {
        method: 'POST',
        body: c.input,
      });
      if (!res.ok) return fail(c.id, `HTTP ${res.status}`);
      const hits = data.resultats || [];
      if (c.expect.minResults != null && hits.length < c.expect.minResults) {
        return fail(c.id, `minResults ${c.expect.minResults} got ${hits.length}`);
      }
      if (c.expect.anyHit) {
        const ok = hits.some((h) => {
          const num = String(h.numero || h.reference || '');
          const art = String(h.article || h.articleNum || '');
          const numOk =
            !c.expect.anyHit.numeroIncludes ||
            c.expect.anyHit.numeroIncludes.some((n) => num.includes(n));
          const artOk =
            !c.expect.anyHit.articleIncludes ||
            c.expect.anyHit.articleIncludes.some((a) => art.includes(a));
          return numOk && artOk;
        });
        if (!ok) return fail(c.id, 'anyHit not matched');
      }
      if (c.expect.maxHighScoreHits != null) {
        const thr = c.expect.highScoreThreshold ?? 85;
        const high = hits.filter((h) => (h.matchScore || 0) >= thr).length;
        if (high > c.expect.maxHighScoreHits) {
          return fail(c.id, `too many high-score hits ${high}`);
        }
      }
      return pass(c.id, `${hits.length} hits · ${ms}ms`);
    }

    case 'qa_citations':
    case 'qa_abstention': {
      const { res, data, ms } = await api('/api/qa', {
        method: 'POST',
        body: c.input,
      });
      if (!res.ok) return fail(c.id, `HTTP ${res.status} ${JSON.stringify(data).slice(0, 120)}`);
      const cits = data.citations || [];
      if (c.expect.allCitationsVerified && cits.some((x) => x.verified === false)) {
        return fail(c.id, 'unverified citation');
      }
      if (c.expect.ifAnswerMinCitations != null && data.mode === 'answer') {
        if (cits.length < c.expect.ifAnswerMinCitations) {
          return fail(c.id, `answer without enough citations`);
        }
      }
      if (c.expect.preferAbstain && data.mode === 'answer' && cits.length === 0) {
        return fail(c.id, 'answer without citations (should abstain)');
      }
      return pass(c.id, `mode=${data.mode} cits=${cits.length} · ${ms}ms`);
    }

    case 'analysis_facts': {
      const { res, data } = await api('/api/analysis/extract-facts', {
        method: 'POST',
        body: { narrative: c.input.narrative },
      });
      if (!res.ok) return fail(c.id, `HTTP ${res.status}`);
      if (c.expect.minQuestions != null && (data.questions || []).length < c.expect.minQuestions) {
        return fail(c.id, 'not enough clarification questions');
      }
      if (c.expect.hasMissingInfo && !(data.factObject?.missingInfo || []).length) {
        return fail(c.id, 'expected missingInfo');
      }
      return pass(c.id, `q=${(data.questions || []).length}`);
    }

    case 'analysis_calc': {
      const ex = await api('/api/analysis/extract-facts', {
        method: 'POST',
        body: { narrative: c.input.narrative },
      });
      if (!ex.res.ok) return fail(c.id, 'extract failed');
      const an = await api('/api/analysis/analyze', {
        method: 'POST',
        body: {
          narrative: c.input.narrative,
          factObject: ex.data.factObject,
          answers: c.input.answers || {},
        },
      });
      if (!an.res.ok) return fail(c.id, 'analyze failed');
      const calcs = an.data.analysis?.calculations || [];
      const sevr = calcs.find((x) => x.id === c.expect.hasCalculationId);
      if (!sevr) return fail(c.id, 'missing calculation');
      if (c.expect.severanceAmount != null) {
        const n = Number(String(sevr.result).replace(/\s/g, ''));
        if (n !== c.expect.severanceAmount) {
          return fail(c.id, `severance ${n} != ${c.expect.severanceAmount}`);
        }
      }
      return pass(c.id, `severance=${sevr.result}`);
    }

    case 'document_validation': {
      const { res } = await api('/api/documents/generate', {
        method: 'POST',
        body: { templateId: c.input.templateId, fields: c.input.fields },
      });
      if (res.status !== (c.expect.httpStatus || 400)) {
        return fail(c.id, `status ${res.status}`);
      }
      return pass(c.id, `status ${res.status}`);
    }

    case 'document_export': {
      const { res, data } = await api('/api/documents/generate', {
        method: 'POST',
        body: { templateId: c.input.templateId, fields: c.input.fields },
      });
      if (!res.ok) return fail(c.id, data.erreur || res.status);
      const body = data.document?.body || '';
      if (c.expect.noUnresolved && (data.document.unresolvedPlaceholders || []).length) {
        return fail(c.id, 'unresolved');
      }
      if (c.expect.noMustache && body.includes('{{')) return fail(c.id, 'mustache left');
      return pass(c.id, 'clean body');
    }

    case 'document_review_gate': {
      const { res } = await api('/api/documents/export', {
        method: 'POST',
        body: {
          templateId: c.input.templateId,
          fields: c.input.fields,
          format: 'pdf',
          confirmProfessionalReview: c.input.confirmProfessionalReview,
        },
      });
      if (c.expect.exportBlocked && res.status !== 403) {
        return fail(c.id, `expected 403 got ${res.status}`);
      }
      return pass(c.id, `blocked ${res.status}`);
    }

    case 'security_isolation': {
      const ts = Date.now();
      const jarA = cookieJar();
      const jarB = cookieJar();
      const pw = 'EvalIsol@tion1!';
      let r = await api('/api/auth/signup', {
        method: 'POST',
        jar: jarA,
        body: { email: `eval.a.${ts}@test.local`, password: pw, fullName: 'Eval A' },
      });
      if (!r.res.ok) return fail(c.id, 'signup A');
      r = await api('/api/auth/signup', {
        method: 'POST',
        jar: jarB,
        body: { email: `eval.b.${ts}@test.local`, password: pw, fullName: 'Eval B' },
      });
      if (!r.res.ok) return fail(c.id, 'signup B');
      r = await api('/api/matters', {
        method: 'POST',
        jar: jarA,
        body: {
          title: 'Dossier secret eval',
          domain: 'Droit du travail',
          parties: [{ name: 'A' }, { name: 'B' }],
          riskLevel: 'high',
          tags: ['eval'],
        },
      });
      if (!r.res.ok) return fail(c.id, 'create matter');
      const id = r.data.matter.id;
      r = await api(`/api/matters/${id}`, { jar: jarB });
      if (r.res.status !== 404) return fail(c.id, `cross access ${r.res.status}`);
      return pass(c.id, 'isolation OK');
    }

    case 'security_injection': {
      const { res, data } = await api('/api/documents/generate', {
        method: 'POST',
        body: { templateId: c.input.templateId, fields: c.input.fields },
      });
      if (!res.ok) return fail(c.id, data.erreur || res.status);
      const body = data.document.body || '';
      if (c.expect.noUnresolved && body.includes('{{admin')) {
        // allowed if escaped as text content - only fail if unresolved mustache remains
      }
      if (c.expect.noUnresolved && (data.document.unresolvedPlaceholders || []).length) {
        return fail(c.id, 'unresolved after injection');
      }
      if (c.expect.noRawMustache && body.includes('{{')) {
        return fail(c.id, 'raw mustache survived injection');
      }
      if (c.expect.bodyContains && !body.includes(c.expect.bodyContains)) {
        return fail(c.id, 'body missing injected text (escaped ok)');
      }
      return pass(c.id, 'injection contained');
    }

    default:
      return fail(c.id, `unknown category ${c.category}`);
  }
}

async function main() {
  const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'));
  console.log(`JurisLex eval ${suite.version} — ${suite.cases.length} cases @ ${BASE}\n`);

  // health
  try {
    await fetch(`${BASE}/api/recherche-legale`);
  } catch {
    console.error('Serveur indisponible. Lancer npm run dev puis npm run eval');
    process.exit(2);
  }

  const results = [];
  let ok = 0;
  for (const c of suite.cases) {
    process.stdout.write(`• ${c.id} … `);
    try {
      const r = await runCase(c);
      results.push({ ...r, category: c.category, description: c.description });
      if (r.ok) {
        ok += 1;
        console.log(`PASS ${r.detail || ''}`);
      } else {
        console.log(`FAIL ${r.detail || ''}`);
      }
    } catch (e) {
      results.push({ id: c.id, ok: false, detail: e.message, category: c.category });
      console.log(`FAIL ${e.message}`);
    }
  }

  const report = {
    suite: suite.version,
    base: BASE,
    at: new Date().toISOString(),
    total: suite.cases.length,
    passed: ok,
    failed: suite.cases.length - ok,
    passRate: Math.round((ok / suite.cases.length) * 1000) / 10,
    results,
    metrics: {
      citationIntegrity: results
        .filter((r) => r.category?.startsWith('qa_'))
        .every((r) => r.ok),
      isolation: results.find((r) => r.id === 'isolation-cross-user')?.ok ?? false,
      noUnresolvedDocs: results.find((r) => r.id === 'doc-no-unresolved')?.ok ?? false,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `report-${suite.version}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(report, null, 2));

  console.log(`\n${ok}/${suite.cases.length} PASS (${report.passRate}%)`);
  console.log(`Rapport: ${outFile}`);
  process.exit(ok === suite.cases.length ? 0 : 1);
}

main();
