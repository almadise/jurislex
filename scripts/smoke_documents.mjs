/**
 * Smoke-test S5 génération documentaire DOCX/PDF.
 * Usage: node scripts/smoke_documents.mjs
 */
const BASE = process.env.JURISLEX_URL || 'http://localhost:4028';
const fs = await import('fs');
const path = await import('path');

async function main() {
  const tplRes = await fetch(`${BASE}/api/documents/templates`);
  const tplData = await tplRes.json();
  if (!tplRes.ok || !tplData.templates?.length) throw new Error('templates missing');
  console.log(
    'templates',
    tplData.templates.length,
    tplData.templates.map((t) => t.id).join(', ')
  );
  if (tplData.templates.length < 5) throw new Error('need 5 templates');

  const fieldsMed = {
    expediteur: 'SARL Creditor Test\nDouala',
    destinataire: 'Ets Debiteur\nYaoundé',
    objet: 'Paiement facture impayée',
    montant: '2 500 000',
    delai: '8 jours',
    fondement_juridique: 'AUPSRVE OHADA et contrat du 01/01/2026',
    faits: 'Facture n°12 du 01/02/2026 restée impayée malgré relance du 01/03/2026.',
  };

  // Generate mise en demeure
  let res = await fetch(`${BASE}/api/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'tpl-mise-en-demeure',
      fields: fieldsMed,
    }),
  });
  let data = await res.json();
  if (!res.ok) throw new Error(`generate: ${JSON.stringify(data)}`);
  if (data.document.unresolvedPlaceholders?.length) {
    throw new Error('unresolved placeholders in generate');
  }
  if (data.document.body.includes('{{')) {
    throw new Error('body still has mustache');
  }
  console.log('generate OK body_len=', data.document.body.length);

  // Missing field must fail
  res = await fetch(`${BASE}/api/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'tpl-mise-en-demeure',
      fields: { ...fieldsMed, montant: '' },
    }),
  });
  if (res.ok) throw new Error('empty field should fail');
  console.log('empty field rejected', res.status);

  // Export DOCX
  res = await fetch(`${BASE}/api/documents/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'tpl-mise-en-demeure',
      fields: fieldsMed,
      format: 'docx',
    }),
  });
  if (!res.ok) throw new Error(`docx ${res.status} ${await res.text()}`);
  const docxBuf = Buffer.from(await res.arrayBuffer());
  if (docxBuf.length < 1000) throw new Error('docx too small');
  // DOCX is zip: PK
  if (docxBuf[0] !== 0x50 || docxBuf[1] !== 0x4b) throw new Error('not a zip/docx');
  const outDir = path.join(process.cwd(), 'build');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'smoke-mise-en-demeure.docx'), docxBuf);
  console.log('docx OK', docxBuf.length, 'bytes');

  // Export PDF
  res = await fetch(`${BASE}/api/documents/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'tpl-mise-en-demeure',
      fields: fieldsMed,
      format: 'pdf',
    }),
  });
  if (!res.ok) throw new Error(`pdf ${res.status}`);
  const pdfBuf = Buffer.from(await res.arrayBuffer());
  if (pdfBuf.slice(0, 4).toString() !== '%PDF') throw new Error('not pdf');
  fs.writeFileSync(path.join(outDir, 'smoke-mise-en-demeure.pdf'), pdfBuf);
  console.log('pdf OK', pdfBuf.length, 'bytes');

  // Requête saisine without confirm → 403
  const saisineFields = {
    demandeur: 'M. Demandeur, Douala',
    defendeur: 'SARL Defendeur, Yaoundé',
    juridiction: 'TGI de Douala',
    objet: 'Paiement de créance',
    faits: 'Créance certaine liquide exigible de 5 000 000 FCFA.',
    moyens_droit: 'AUDCG et AUPSRVE OHADA',
    pretentions: 'Condamner le défendeur au paiement de 5 000 000 FCFA',
  };
  res = await fetch(`${BASE}/api/documents/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'tpl-requete-saisine',
      fields: saisineFields,
      format: 'pdf',
      confirmProfessionalReview: false,
    }),
  });
  if (res.status !== 403) throw new Error(`expected 403 got ${res.status}`);
  console.log('saisine blocked without review OK');

  res = await fetch(`${BASE}/api/documents/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'tpl-requete-saisine',
      fields: saisineFields,
      format: 'pdf',
      confirmProfessionalReview: true,
    }),
  });
  if (!res.ok) throw new Error(`saisine export ${res.status}`);
  console.log('saisine export with confirm OK');

  console.log('OK smoke documents');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
