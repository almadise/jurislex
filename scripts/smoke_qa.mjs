/**
 * Smoke-test Q&A sourcée (serveur dev :4028).
 * Usage: node scripts/smoke_qa.mjs
 */
const BASE = process.env.JURISLEX_URL || 'http://localhost:4028';

async function main() {
  const status = await fetch(`${BASE}/api/qa`).then((r) => r.json());
  console.log('GET /api/qa', status);

  // 1) Question ancrée sur le corpus (Code du travail)
  const r1 = await fetch(`${BASE}/api/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'Que dit la loi 92-007 article 40 sur le contrat de travail ?',
      retrievalLimit: 10,
    }),
  }).then((r) => r.json());

  if (r1.erreur) throw new Error(r1.erreur);

  console.log('Q1 mode=', r1.mode, 'engine=', r1.generation?.engine, 'cits=', r1.citations?.length);
  console.log(
    ' citations verified=',
    (r1.citations || []).every((c) => c.verified),
    ' sample=',
    r1.citations?.[0]?.article,
    r1.citations?.[0]?.reference
  );

  if (!r1.citations?.length && r1.mode === 'answer') {
    throw new Error('FAIL: mode answer sans citation');
  }
  for (const c of r1.citations || []) {
    if (!c.verified) throw new Error(`FAIL: citation non vérifiée ${c.id}`);
    if (!c.excerpt || c.excerpt.length < 5) throw new Error(`FAIL: extrait vide ${c.id}`);
  }

  // 2) Question hors corpus probable → abstention ou uncertainties
  const r2 = await fetch(`${BASE}/api/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'Quel est le taux de TVA sur les licornes spatiales en Antarctique en 2099 ?',
      retrievalLimit: 8,
      minRetrievalScore: 50,
    }),
  }).then((r) => r.json());

  if (r2.erreur) throw new Error(r2.erreur);
  console.log('Q2 mode=', r2.mode, 'cits=', r2.citations?.length, 'risk=', r2.riskLevel);

  // Toute citation affichée doit être verified
  for (const c of r2.citations || []) {
    if (!c.verified) throw new Error('FAIL Q2: citation non vérifiée');
  }

  console.log('OK smoke qa');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
