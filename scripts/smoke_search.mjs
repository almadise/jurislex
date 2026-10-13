/**
 * Smoke-test local de l'API recherche (serveur dev requis sur :4028).
 * Usage: node scripts/smoke_search.mjs
 */
const BASE = process.env.JURISLEX_URL || 'http://localhost:4028';

async function post(body) {
  const r = await fetch(`${BASE}/api/recherche-legale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.erreur || r.statusText);
  return j;
}

async function main() {
  const status = await fetch(`${BASE}/api/recherche-legale`).then((r) => r.json());
  console.log('status', status);

  const exact = await post({
    query: 'article 40 loi 92-007',
    mode: 'exact',
    limit: 3,
  });
  console.log(
    'exact',
    exact.total,
    exact.resultats.map((x) => `${x.article} n°${x.numero} score=${x.matchScore}`)
  );
  if (!exact.resultats.some((x) => String(x.numero).includes('1992') || String(x.numero).includes('92'))) {
    console.error('FAIL: attendu Code du travail 1992-007 art. 40');
    process.exit(1);
  }

  const lexical = await post({
    query: 'titre foncier',
    mode: 'lexical',
    limit: 3,
    filters: { categories: ['04_Foncier_domanial_urbanisme'] },
  });
  console.log('lexical foncier', lexical.total);

  console.log('OK smoke search');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
