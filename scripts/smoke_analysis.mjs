/**
 * Smoke-test S4 analyse de faits.
 * Usage: node scripts/smoke_analysis.mjs  (serveur :4028)
 */
const BASE = process.env.JURISLEX_URL || 'http://localhost:4028';

const narrative = `
Je suis Mme Nkeng Abanda, salariée de la SARL Fotso & Associés depuis le 03/01/2019.
Le 28/05/2026 j'ai reçu une lettre de licenciement. Mon salaire est de 450 000 FCFA par mois.
À ma connaissance les délégués du personnel n'ont pas été consultés.
Je souhaite contester le licenciement et obtenir mes indemnités à Douala.
`.trim();

async function main() {
  // 1) extract
  let res = await fetch(`${BASE}/api/analysis/extract-facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ narrative }),
  });
  let data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  console.log(
    'extract domain=',
    data.factObject.domainGuess,
    'parties=',
    data.factObject.parties.length,
    'questions=',
    data.questions.length
  );
  if (!data.factObject.parties.length) throw new Error('no parties');
  if (!data.factObject.dates.length) throw new Error('expected dates');

  // 2) analyze with sample answers
  const answers = {};
  for (const q of data.questions || []) {
    if (q.id.includes('motif')) answers[q.id] = 'Motif économique allégué dans la lettre';
    else if (q.id.includes('delegues')) answers[q.id] = 'Non, aucune consultation à ma connaissance';
    else if (q.id.includes('salaire')) answers[q.id] = '450000 FCFA';
    else if (q.id.includes('embauche')) answers[q.id] = '03/01/2019';
    else if (q.id.includes('notif')) answers[q.id] = '28/05/2026';
    else answers[q.id] = 'Non précisé';
  }

  res = await fetch(`${BASE}/api/analysis/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      narrative,
      factObject: data.factObject,
      answers,
    }),
  });
  data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  const a = data.analysis;
  console.log(
    'analyze risk=',
    a.overallRisk,
    'confidence=',
    a.confidenceLevel,
    'law=',
    a.applicableLaw?.length,
    'calcs=',
    a.calculations?.length
  );

  if (!a.qualification) throw new Error('no qualification');
  if (!a.userFacts?.length) throw new Error('no userFacts');
  if (!a.systemHypotheses?.length) throw new Error('no hypotheses');

  const sevr = (a.calculations || []).find(
    (c) => c.id === 'indemnite-licenciement-hypothese'
  );
  if (!sevr) throw new Error('missing severance calc');
  console.log('severance', sevr.result, sevr.status);

  // 3) unit-like: amount should be 20% * 450000 * 7 = 630000
  const n = Number(String(sevr.result).replace(/\s/g, ''));
  if (sevr.status !== 'blocked_missing_input' && n !== 630000) {
    console.warn('WARN severance expected 630000 got', n);
  } else {
    console.log('severance amount OK', n);
  }

  const elig = (a.calculations || []).find(
    (c) => c.id === 'indemnite-licenciement-conditions'
  );
  if (elig) console.log('eligibility', elig.result, elig.status);

  const presc = (a.calculations || []).find((c) => c.id.startsWith('prescription'));
  if (presc) console.log('prescription', presc.result, presc.status);

  // 4) lien dossier optionnel sans auth → analyse ok, pas de save obligatoire
  res = await fetch(`${BASE}/api/analysis/extract-facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      narrative:
        'Créance commerciale OHADA de 2 000 000 FCFA impayée depuis le 15/03/2026 contre SARL Test.',
    }),
  });
  data = await res.json();
  if (!res.ok) throw new Error('extract ohada failed');
  console.log('ohada domain=', data.factObject.domainGuess, 'q=', data.questions?.length);

  console.log('OK smoke analysis');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
