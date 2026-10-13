/**
 * Moteur de calculs juridiques déterministes (testable).
 * Ne jamais laisser le LLM inventer indemnités / délais sans passer ici.
 *
 * C2a : règles ancrées corpus (verified) vs barèmes encore hypothesis_only.
 */

import type { DeterministicCalc } from '@/lib/contracts/analysis';
import { getRuleAnchor } from './ruleRegistry';

/** Parse dates FR (JJ/MM/AAAA) ou ISO. */
export function parseDateFlexible(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = input.trim();
  const fr = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
  if (fr) {
    const d = new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function formatDateFr(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function yearsBetween(start: Date, end: Date): number {
  return Math.floor(monthsBetween(start, end) / 12);
}

/** Extrait un montant en FCFA depuis une chaîne. */
export function parseFcfaAmount(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(/FCFA|XAF|f\.?cfa/gi, '');
  const m = cleaned.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[,.]\d+)?/);
  if (!m) return null;
  const n = Number(m[1].replace(/[.\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function withAnchor(
  calc: DeterministicCalc,
  ruleId: string,
  statusOverride?: DeterministicCalc['status']
): DeterministicCalc {
  const a = getRuleAnchor(ruleId);
  if (!a) return calc;
  return {
    ...calc,
    id: ruleId,
    legalReferences: a.legalReferences,
    status: statusOverride ?? (a.status === 'verified' ? 'computed' : a.status === 'hypothesis_only' ? 'hypothesis_only' : calc.status),
    assumptions: [
      ...calc.assumptions,
      ...a.notes,
      `Règle ${a.version} · ancrage ${a.status}`,
    ],
    // métadonnées pour UI / lecteur (hors schéma strict → cast via spread)
    ...( {
      ruleStatus: a.status,
      sourcePaths: a.sourcePaths,
      articles: a.articles,
    } as Partial<DeterministicCalc>),
  };
}

/**
 * Prescription Art. 74 Code du travail — 3 ans (verified).
 * Couvre salaire et indemnités de rupture assimilées.
 */
export function calcPrescriptionSalaryIndemnity(startDate: Date): DeterministicCalc {
  const end = new Date(startDate);
  end.setFullYear(end.getFullYear() + 3);
  return withAnchor(
    {
      id: 'prescription-salaire-indemnites-3ans',
      label: 'Échéance de prescription (salaire / indemnités de rupture)',
      result: formatDateFr(end),
      formula: 'date_exigibilité + 3 ans (Art. 74)',
      assumptions: [
        `Point de départ retenu : ${formatDateFr(startDate)} (date d’exigibilité fournie).`,
        'Interruptions possibles (réclamation écrite inspecteur, citation en justice…) non modélisées ici.',
      ],
      legalReferences: [],
      status: 'computed',
    },
    'prescription-salaire-indemnites-3ans',
    'computed'
  );
}

/** @deprecated alias — pointe vers la règle verified 3 ans */
export function calcPrescriptionDeadline(
  startDate: Date,
  _yearsIgnored = 3
): DeterministicCalc {
  return calcPrescriptionSalaryIndemnity(startDate);
}

/**
 * Conditions d’ouverture indemnité de licenciement — Art. 37 (verified).
 * Ne calcule pas le montant.
 */
export function calcSeveranceEligibility(input: {
  hireDate: Date | null;
  endDate: Date | null;
  employerInitiated?: boolean | null;
  seriousMisconduct?: boolean | null;
}): DeterministicCalc {
  const id = 'indemnite-licenciement-conditions';
  if (!input.hireDate || !input.endDate) {
    return withAnchor(
      {
        id,
        label: 'Conditions indemnité de licenciement (Art. 37)',
        result: '—',
        formula: 'CDI + initiative employeur + hors faute lourde + ancienneté ≥ 2 ans',
        assumptions: ['Date d’embauche et date de fin requises.'],
        legalReferences: [],
        status: 'blocked_missing_input',
      },
      id,
      'blocked_missing_input'
    );
  }

  const years = yearsBetween(input.hireDate, input.endDate);
  const employerOk = input.employerInitiated !== false; // défaut prudent : on suppose licenciement si non précisé
  const noMisconduct = input.seriousMisconduct !== true;
  const seniorityOk = years >= 2;
  const eligible = employerOk && noMisconduct && seniorityOk;

  return withAnchor(
    {
      id,
      label: 'Conditions indemnité de licenciement (Art. 37)',
      result: eligible ? 'conditions remplies (principe)' : 'conditions non réunies',
      formula: 'Art. 37 : ≥2 ans + rupture CDI employeur + hors faute lourde',
      assumptions: [
        `Ancienneté : ${years} an(s) (${formatDateFr(input.hireDate)} → ${formatDateFr(input.endDate)})`,
        `Initiative employeur retenue : ${employerOk ? 'oui' : 'non'}`,
        `Faute lourde alléguée : ${input.seriousMisconduct === true ? 'oui' : 'non / non précisé'}`,
        'Le montant monétaire n’est pas fixé par l’Art. 37 seul (arrêté).',
      ],
      legalReferences: [],
      status: 'computed',
    },
    id,
    'computed'
  );
}

/**
 * Indemnité de licenciement — montant hypothétique (barème 20/25 %).
 * Art. 37 ouvre le droit ; le calcul monétaire reste hypothesis_only.
 */
export function calcSeveranceHypothesis(input: {
  monthlySalary: number | null;
  hireDate: Date | null;
  endDate: Date | null;
}): DeterministicCalc {
  const id = 'indemnite-licenciement-hypothese';
  if (input.monthlySalary == null || !input.hireDate || !input.endDate) {
    return withAnchor(
      {
        id,
        label: 'Indemnité de licenciement (montant indicatif)',
        result: '—',
        unit: 'FCFA',
        formula: '0,20 × salaire × min(années,10) + 0,25 × salaire × max(années-10,0) si ≥ 2 ans',
        assumptions: [
          'Salaire mensuel brut, date d’embauche et date de fin requis.',
          'Barème purement indicatif — non issu d’une génération LLM libre.',
        ],
        legalReferences: [],
        status: 'blocked_missing_input',
      },
      id,
      'blocked_missing_input'
    );
  }

  const years = yearsBetween(input.hireDate, input.endDate);
  if (years < 2) {
    return withAnchor(
      {
        id,
        label: 'Indemnité de licenciement (montant indicatif)',
        result: '0',
        unit: 'FCFA',
        formula: 'ancienneté < 2 ans → 0 sous cette hypothèse (cohérent Art. 37)',
        assumptions: [
          `Ancienneté calculée : ${years} an(s) (${formatDateFr(input.hireDate)} → ${formatDateFr(input.endDate)}).`,
        ],
        legalReferences: [],
        status: 'hypothesis_only',
      },
      id
    );
  }

  const salary = input.monthlySalary;
  const y1 = Math.min(years, 10);
  const y2 = Math.max(years - 10, 0);
  const amount = Math.round(0.2 * salary * y1 + 0.25 * salary * y2);

  return withAnchor(
    {
      id,
      label: 'Indemnité de licenciement (montant indicatif)',
      result: amount.toLocaleString('fr-FR'),
      unit: 'FCFA',
      formula: `0,20×${salary}×${y1} + 0,25×${salary}×${y2}`,
      assumptions: [
        `Salaire mensuel retenu : ${salary.toLocaleString('fr-FR')} FCFA`,
        `Ancienneté : ${years} année(s) complète(s)`,
        'Barème 20%/25% = hypothèse ; vérifier arrêté / convention collective.',
      ],
      legalReferences: [],
      status: 'hypothesis_only',
    },
    id
  );
}

/** Obligation de préavis — Art. 34 (verified). */
export function calcNoticeObligation(): DeterministicCalc {
  return withAnchor(
    {
      id: 'preavis-obligation',
      label: 'Obligation de préavis (CDI)',
      result: 'préavis écrit obligatoire (sauf faute lourde)',
      formula: 'Art. 34 — notification écrite + motif',
      assumptions: [
        'Durée du préavis fixée par arrêté (non codifiée ici).',
      ],
      legalReferences: [],
      status: 'computed',
    },
    'preavis-obligation',
    'computed'
  );
}

/** Durée de préavis — tranches indicatives (hypothesis). */
export function calcNoticeMonthsHypothesis(yearsSeniority: number): DeterministicCalc {
  let months = 1;
  if (yearsSeniority >= 1 && yearsSeniority < 5) months = 1;
  else if (yearsSeniority >= 5 && yearsSeniority < 10) months = 2;
  else if (yearsSeniority >= 10) months = 3;
  else months = 0;

  return withAnchor(
    {
      id: 'preavis-duree-hypothese',
      label: 'Durée de préavis (hypothèse)',
      result: String(months),
      unit: 'mois',
      formula: 'tranches d’ancienneté indicatives (0 / 1 / 2 / 3 mois)',
      assumptions: [
        `Ancienneté retenue : ${yearsSeniority} an(s)`,
        'Barème simplifié — vérifier catégorie professionnelle et arrêté.',
      ],
      legalReferences: [],
      status: 'hypothesis_only',
    },
    'preavis-duree-hypothese'
  );
}

/**
 * Indemnité de préavis non respecté — Art. 36 (verified).
 * Montant = salaire mensuel × mois de préavis non observés.
 */
export function calcNoticeIndemnity(input: {
  monthlySalary: number | null;
  noticeMonths: number | null;
  seriousMisconduct?: boolean | null;
}): DeterministicCalc {
  const id = 'indemnite-preavis-non-respecte';
  if (input.seriousMisconduct === true) {
    return withAnchor(
      {
        id,
        label: 'Indemnité de préavis non respecté (Art. 36)',
        result: '0 (faute lourde alléguée — sous contrôle du juge)',
        unit: 'FCFA',
        formula: 'Art. 36 al. 2 — rupture sans préavis si faute lourde',
        assumptions: ['La gravité de la faute est appréciée par le juge.'],
        legalReferences: [],
        status: 'computed',
      },
      id,
      'computed'
    );
  }
  if (input.monthlySalary == null || input.noticeMonths == null) {
    return withAnchor(
      {
        id,
        label: 'Indemnité de préavis non respecté (Art. 36)',
        result: '—',
        unit: 'FCFA',
        formula: 'salaire mensuel × mois de préavis non observés',
        assumptions: ['Salaire et durée de préavis requis.'],
        legalReferences: [],
        status: 'blocked_missing_input',
      },
      id,
      'blocked_missing_input'
    );
  }
  const amount = Math.round(input.monthlySalary * input.noticeMonths);
  return withAnchor(
    {
      id,
      label: 'Indemnité de préavis non respecté (Art. 36)',
      result: amount.toLocaleString('fr-FR'),
      unit: 'FCFA',
      formula: `${input.noticeMonths} × ${input.monthlySalary} (rémunération du préavis non observé)`,
      assumptions: [
        'Montant = rémunération et avantages pendant le délai non respecté.',
        'La durée de préavis utilisée peut elle-même être hypothesis_only si issue des tranches indicatives.',
      ],
      legalReferences: [],
      status: 'computed',
    },
    id,
    'computed'
  );
}

/**
 * OHADA — délai d’opposition à l’injonction de payer : 10 jours (Art. 10 AUPSRVE).
 */
export function calcOhadaOppositionDeadline(significationDate: Date): DeterministicCalc {
  const end = addDays(significationDate, 10);
  return withAnchor(
    {
      id: 'ohada-opposition-injonction-10j',
      label: 'Échéance opposition injonction de payer (OHADA)',
      result: formatDateFr(end),
      formula: 'date_signification + 10 jours (Art. 10 AUPSRVE)',
      assumptions: [
        `Signification retenue : ${formatDateFr(significationDate)}`,
        'Délais de distance éventuels non ajoutés automatiquement.',
        'Si signification non personnelle : régime Art. 10 al. 2 (opposition jusqu’à 10 j après 1ʳᵉ mesure d’exécution) non détaillé ici.',
      ],
      legalReferences: [],
      status: 'computed',
    },
    'ohada-opposition-injonction-10j',
    'computed'
  );
}

/**
 * OHADA — date minimale de saisie-vente après commandement : +8 jours (Art. 92).
 */
export function calcOhadaSaisieVenteEarliest(commandementDate: Date): DeterministicCalc {
  const earliest = addDays(commandementDate, 8);
  return withAnchor(
    {
      id: 'ohada-commandement-saisie-vente-8j',
      label: 'Date au plus tôt saisie-vente après commandement',
      result: formatDateFr(earliest),
      formula: 'date_commandement + 8 jours (Art. 92 AUPSRVE)',
      assumptions: [
        `Commandement retenu : ${formatDateFr(commandementDate)}`,
        'Autres conditions (titre exécutoire, créance liquide et exigible) à vérifier.',
      ],
      legalReferences: [],
      status: 'computed',
    },
    'ohada-commandement-saisie-vente-8j',
    'computed'
  );
}

export function runDeterministicCalculations(ctx: {
  hireDate: Date | null;
  endOrNotifDate: Date | null;
  monthlySalary: number | null;
  /** Dates OHADA optionnelles (labels faits) */
  ohadaSignificationDate?: Date | null;
  ohadaCommandementDate?: Date | null;
  employerInitiated?: boolean | null;
  seriousMisconduct?: boolean | null;
}): DeterministicCalc[] {
  const out: DeterministicCalc[] = [];

  if (ctx.endOrNotifDate) {
    out.push(calcPrescriptionSalaryIndemnity(ctx.endOrNotifDate));
  }

  out.push(
    calcSeveranceEligibility({
      hireDate: ctx.hireDate,
      endDate: ctx.endOrNotifDate,
      employerInitiated: ctx.employerInitiated,
      seriousMisconduct: ctx.seriousMisconduct,
    })
  );

  out.push(
    calcSeveranceHypothesis({
      monthlySalary: ctx.monthlySalary,
      hireDate: ctx.hireDate,
      endDate: ctx.endOrNotifDate,
    })
  );

  out.push(calcNoticeObligation());

  if (ctx.hireDate && ctx.endOrNotifDate) {
    const y = yearsBetween(ctx.hireDate, ctx.endOrNotifDate);
    const notice = calcNoticeMonthsHypothesis(y);
    out.push(notice);
    const m = Number(notice.result) || 0;
    out.push(
      calcNoticeIndemnity({
        monthlySalary: ctx.monthlySalary,
        noticeMonths: m > 0 ? m : null,
        seriousMisconduct: ctx.seriousMisconduct,
      })
    );
  }

  if (ctx.ohadaSignificationDate) {
    out.push(calcOhadaOppositionDeadline(ctx.ohadaSignificationDate));
  }
  if (ctx.ohadaCommandementDate) {
    out.push(calcOhadaSaisieVenteEarliest(ctx.ohadaCommandementDate));
  }

  return out;
}
