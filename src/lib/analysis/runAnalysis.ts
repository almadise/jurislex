import { randomUUID } from 'crypto';
import type {
  ClarificationQuestion,
  FactObject,
  StructuredAnalysis,
} from '@/lib/contracts/analysis';
import { runSearch } from '@/lib/search/runSearch';
import {
  extractFactsFromNarrative,
  buildClarificationQuestions,
  mergeAnswersIntoFacts,
} from './extractFacts';
import {
  parseDateFlexible,
  parseFcfaAmount,
  runDeterministicCalculations,
} from './rules';

export interface ExtractResult {
  factObject: FactObject;
  questions: ClarificationQuestion[];
  narrative: string;
}

export function extractFactsPhase(narrative: string): ExtractResult {
  const factObject = extractFactsFromNarrative(narrative);
  const questions = buildClarificationQuestions(factObject);
  return { factObject, questions, narrative };
}

export async function runFullAnalysis(input: {
  narrative: string;
  factObject?: FactObject;
  answers?: Record<string, string>;
  matterId?: string | null;
}): Promise<StructuredAnalysis> {
  let facts = input.factObject ?? extractFactsFromNarrative(input.narrative);
  if (input.answers && Object.keys(input.answers).length) {
    facts = mergeAnswersIntoFacts(facts, input.answers);
  }

  // Enrichir faits utilisateur / hypothèses
  const userFacts = [
    ...facts.admittedFacts,
    ...facts.dates.map((d) => `${d.label} : ${d.date}`),
    ...facts.amounts.map((a) => `${a.label} : ${a.amount}`),
  ];
  const systemHypotheses = [
    ...(facts.hypotheses || []),
    `Domaine estimé : ${facts.domainGuess || 'non classé'}`,
    `Relation juridique estimée : ${facts.legalRelation}`,
  ];

  // Calculs déterministes
  const hire = facts.dates.find((d) => /embauche/i.test(d.label));
  const notif = facts.dates.find((d) => /licenciement|notification/i.test(d.label));
  // Prendre le salaire le plus plausible (montant max labellisé salaire, sinon max montant)
  const salaryCandidates = facts.amounts
    .filter((a) => /salaire/i.test(a.label))
    .map((a) => parseFcfaAmount(a.amount))
    .filter((n): n is number => n != null && n >= 50000);
  const anyAmounts = facts.amounts
    .map((a) => parseFcfaAmount(a.amount))
    .filter((n): n is number => n != null && n >= 50000);
  const monthlySalary =
    salaryCandidates.length > 0
      ? Math.max(...salaryCandidates)
      : anyAmounts.length > 0
        ? Math.max(...anyAmounts)
        : null;
  const ohadaSig = facts.dates.find((d) =>
    /signification|injonction/i.test(d.label)
  );
  const ohadaCmd = facts.dates.find((d) =>
    /commandement/i.test(d.label)
  );
  const misconductHint =
    /faute\s+lourde/i.test(input.narrative) ||
    facts.admittedFacts.some((f) => /faute\s+lourde/i.test(f));
  const calculations = runDeterministicCalculations({
    hireDate: hire ? parseDateFlexible(hire.date) : null,
    endOrNotifDate: notif ? parseDateFlexible(notif.date) : null,
    monthlySalary,
    ohadaSignificationDate: ohadaSig ? parseDateFlexible(ohadaSig.date) : null,
    ohadaCommandementDate: ohadaCmd ? parseDateFlexible(ohadaCmd.date) : null,
    employerInitiated: /licenciement|employeur/i.test(input.narrative)
      ? true
      : null,
    seriousMisconduct: misconductHint ? true : null,
  });

  // Injecter montants calculés comme hypothèses (pas faits utilisateur)
  for (const c of calculations) {
    if (c.status === 'blocked_missing_input' || c.result === '—') continue;
    systemHypotheses.push(
      `${c.label} = ${c.result}${c.unit ? ' ' + c.unit : ''} [${c.status}]`
    );
    if (c.id.includes('indemnite')) {
      facts.amounts = [
        ...facts.amounts.filter((a) => !/indemnité de licenciement estimée/i.test(a.label)),
        {
          label: 'Indemnité de licenciement estimée (hypothèse moteur)',
          amount: `${c.result} ${c.unit || ''}`.trim(),
        },
      ];
    }
  }

  // Urgences depuis prescription
  const presc = calculations.find((c) => c.id.startsWith('prescription'));
  if (presc && presc.result !== '—') {
    facts.urgencies = [
      ...facts.urgencies,
      `Prescription indicative : échéance calculée au ${presc.result} (voir hypothèses du moteur de règles)`,
    ];
  }

  // Retrieval droit applicable
  const queryParts = [
    facts.domainGuess,
    facts.legalRelation,
    ...facts.legalIssues.slice(0, 2),
    facts.domainGuess?.includes('travail') ? 'licenciement code travail 92-007' : '',
    facts.domainGuess?.includes('OHADA') ? 'injonction de payer OHADA' : '',
    facts.domainGuess?.includes('foncier') ? 'titre foncier ordonnance' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const retrieval = await runSearch({
    query: queryParts || input.narrative.slice(0, 400),
    mode: 'hybrid',
    limit: 8,
    filters: domainToFilter(facts.domainGuess),
  });

  const applicableLaw = retrieval.resultats.slice(0, 6).map((h) => ({
    reference: h.reference,
    article: h.article,
    relevance: h.matchReason || h.domain,
    sourceId: h.id,
    page: h.page,
    excerpt: h.excerpt.slice(0, 240),
    verified: true as const,
  }));

  const qualification = buildQualification(facts, applicableLaw.length);
  const risks = buildRisks(facts, calculations);
  const evidence = buildEvidence(facts);
  const nextSteps = buildNextSteps(facts, calculations);
  const overallRisk = risks.some((r) => r.level === 'high')
    ? 'high'
    : risks.some((r) => r.level === 'medium')
      ? 'medium'
      : 'low';

  // Confiance : baisse si peu de sources
  let confidence = facts.confidenceLevel;
  if (applicableLaw.length === 0) confidence = Math.min(confidence, 40);
  if (applicableLaw.length >= 3) confidence = Math.min(92, confidence + 5);

  return {
    id: randomUUID(),
    factObject: facts,
    applicableLaw,
    qualification,
    risks,
    evidence,
    nextSteps,
    overallRisk,
    confidenceLevel: confidence,
    calculations,
    userFacts,
    systemHypotheses,
    warningMessage:
      'Analyse d’assistance documentaire fondée sur le récit, des règles déterministes et le corpus récupéré. ' +
      'Ce n’est pas un avis d’avocat. Les calculs marqués hypothesis_only doivent être validés sur le texte applicable.',
    matterId: input.matterId ?? null,
    engine: 'rules',
  };
}

function domainToFilter(domain?: string) {
  if (!domain) return undefined;
  if (domain.includes('travail')) {
    return { categories: ['18_Securite_sociale'] };
  }
  if (domain.includes('OHADA')) {
    return { categories: ['02_Droit_OHADA'], jurisdictions: ['OHADA'] };
  }
  if (domain.includes('foncier')) {
    return { categories: ['04_Foncier_domanial_urbanisme'] };
  }
  if (domain.includes('Marchés')) {
    return { categories: ['08_Marches_publics'] };
  }
  return undefined;
}

function buildQualification(
  facts: FactObject,
  lawCount: number
): string {
  const parts: string[] = [];
  parts.push(`Qualification provisoire — domaine estimé : ${facts.domainGuess || 'à préciser'}.`);
  parts.push(`Relation : ${facts.legalRelation}.`);
  if (facts.disputedFacts.length) {
    parts.push(
      `Points non stabilisés : ${facts.disputedFacts.slice(0, 2).join(' ; ')}.`
    );
  }
  if (lawCount === 0) {
    parts.push(
      'Aucune disposition corpus n’a pu être reliée de façon fiable : conclusion prudente, mode quasi-abstention sur le droit positif.'
    );
  } else {
    parts.push(
      `${lawCount} disposition(s) récupérée(s) dans le corpus pour étayer le droit applicable (voir sources vérifiées).`
    );
  }
  parts.push(`Objectif déclaré : ${facts.objective}.`);
  return parts.join(' ');
}

function buildRisks(
  facts: FactObject,
  calcs: { id: string; status: string; result: string }[]
): { level: 'low' | 'medium' | 'high'; description: string }[] {
  const risks: { level: 'low' | 'medium' | 'high'; description: string }[] = [];
  if (facts.missingInfo.length >= 3) {
    risks.push({
      level: 'high',
      description: `Informations manquantes nombreuses (${facts.missingInfo.length}) — risque d’erreur de qualification`,
    });
  }
  if (facts.disputedFacts.length) {
    risks.push({
      level: 'medium',
      description: 'Faits contestés ou non confirmés susceptibles de modifier l’analyse',
    });
  }
  const presc = calcs.find((c) => c.id.startsWith('prescription'));
  if (presc) {
    risks.push({
      level: 'low',
      description: `Délai de prescription indicatif calculé (échéance ${presc.result}) — vérifier le texte applicable`,
    });
  }
  if (!risks.length) {
    risks.push({
      level: 'medium',
      description: 'Risque standard d’une analyse automatisée sans revue professionnelle',
    });
  }
  return risks;
}

function buildEvidence(
  facts: FactObject
): { item: string; status: 'available' | 'to_gather' | 'missing' }[] {
  const items: { item: string; status: 'available' | 'to_gather' | 'missing' }[] =
    facts.missingInfo.map((m) => ({
      item: m,
      status: 'to_gather' as const,
    }));
  if (facts.amounts.some((a) => /salaire/i.test(a.label))) {
    items.push({
      item: 'Éléments de rémunération déclarés dans le récit',
      status: 'available',
    });
  }
  if (!items.length) {
    items.push({ item: 'Pièces justificatives générales du dossier', status: 'to_gather' });
  }
  return items.slice(0, 8);
}

function buildNextSteps(
  facts: FactObject,
  calcs: { id: string; result: string; status: string }[]
): { priority: number; action: string; deadline?: string }[] {
  const steps: { priority: number; action: string; deadline?: string }[] = [];
  let p = 1;
  for (const m of facts.missingInfo.slice(0, 3)) {
    steps.push({ priority: p++, action: `Rassembler : ${m}` });
  }
  steps.push({
    priority: p++,
    action: 'Recouper les sources juridiques affichées avec le texte intégral (page indiquée)',
  });
  const sevr = calcs.find((c) => c.id.includes('indemnite'));
  if (sevr && sevr.status !== 'blocked_missing_input') {
    steps.push({
      priority: p++,
      action: `Vérifier le calcul d’indemnité (${sevr.result}) au regard du texte et de la convention collective`,
    });
  }
  steps.push({
    priority: p++,
    action: 'Envisager une mise en demeure ou un recours après validation professionnelle',
  });
  if (facts.domainGuess?.includes('travail')) {
    steps.push({
      priority: p++,
      action: 'En cas de litige durable : saisine de la juridiction sociale compétente',
    });
  }
  return steps.slice(0, 6);
}
