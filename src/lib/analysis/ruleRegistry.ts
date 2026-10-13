/**
 * Registre des règles juridiques déterministes (C2a).
 * status:
 *  - verified     : ancré sur un article du corpus indexé
 *  - hypothesis_only : formule indicative (arrêté non indexé, barème provisoire…)
 *  - provisional  : structure prête, validation juriste en cours
 */

export type RuleVerificationStatus = 'verified' | 'hypothesis_only' | 'provisional';

export interface RuleAnchor {
  id: string;
  label: string;
  domain: 'travail_cm' | 'ohada_recouvrement' | 'general';
  status: RuleVerificationStatus;
  /** Références lisibles + ancrage corpus */
  legalReferences: string[];
  /** Chemins corpus / slugs pour le lecteur */
  sourcePaths: string[];
  articles: string[];
  notes: string[];
  /** Version du barème / règle */
  version: string;
}

export const RULE_REGISTRY: RuleAnchor[] = [
  {
    id: 'prescription-salaire-indemnites-3ans',
    label: 'Prescription action salaire & indemnités de rupture (3 ans)',
    domain: 'travail_cm',
    status: 'verified',
    legalReferences: [
      'Loi n° 92-007 du 14 août 1992 (Code du travail) — Art. 74',
    ],
    sourcePaths: [
      '18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf',
    ],
    articles: ['74'],
    notes: [
      'L’action en paiement du salaire se prescrit par trois ans.',
      'Les indemnités liées à la rupture sont assimilées au salaire pour la prescription.',
      'Point de départ : date à laquelle les salaires sont exigibles (Art. 74 al. 2).',
    ],
    version: 'c2a-1.0.0',
  },
  {
    id: 'indemnite-licenciement-conditions',
    label: 'Conditions d’ouverture de l’indemnité de licenciement',
    domain: 'travail_cm',
    status: 'verified',
    legalReferences: [
      'Loi n° 92-007 — Art. 37',
    ],
    sourcePaths: [
      '18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf',
    ],
    articles: ['37'],
    notes: [
      'CDI rompu du fait de l’employeur, hors faute lourde.',
      'Ancienneté continue ≥ 2 ans dans l’entreprise.',
      'Le montant relève d’un arrêté ministériel (non codifié ici) → calcul monétaire séparément hypothesis_only.',
    ],
    version: 'c2a-1.0.0',
  },
  {
    id: 'indemnite-licenciement-hypothese',
    label: 'Montant indemnité de licenciement (barème indicatif)',
    domain: 'travail_cm',
    status: 'hypothesis_only',
    legalReferences: [
      'Loi n° 92-007 — Art. 37 (principe) ; modalités par arrêté non indexé',
    ],
    sourcePaths: [
      '18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf',
    ],
    articles: ['37'],
    notes: [
      'Barème 20 % / 25 % = hypothèse JurisLex en attendant l’arrêté applicable indexé.',
    ],
    version: 'c2a-1.0.0',
  },
  {
    id: 'preavis-obligation',
    label: 'Obligation de préavis (CDI)',
    domain: 'travail_cm',
    status: 'verified',
    legalReferences: ['Loi n° 92-007 — Art. 34'],
    sourcePaths: [
      '18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf',
    ],
    articles: ['34'],
    notes: [
      'Résiliation CDI subordonnée à un préavis notifié par écrit avec motif.',
      'Durée fixée par arrêté (ancienneté + classification) → durée en mois reste hypothesis_only.',
    ],
    version: 'c2a-1.0.0',
  },
  {
    id: 'preavis-duree-hypothese',
    label: 'Durée de préavis (tranches indicatives)',
    domain: 'travail_cm',
    status: 'hypothesis_only',
    legalReferences: ['Loi n° 92-007 — Art. 34 (renvoi à arrêté)'],
    sourcePaths: [
      '18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf',
    ],
    articles: ['34'],
    notes: ['Tranches 0/1/2/3 mois = orientation uniquement.'],
    version: 'c2a-1.0.0',
  },
  {
    id: 'indemnite-preavis-non-respecte',
    label: 'Indemnité de préavis non respecté',
    domain: 'travail_cm',
    status: 'verified',
    legalReferences: ['Loi n° 92-007 — Art. 36'],
    sourcePaths: [
      '18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf',
    ],
    articles: ['36'],
    notes: [
      'Montant = rémunération et avantages pendant le délai de préavis non observé.',
      'Exception : faute lourde (sous contrôle du juge).',
    ],
    version: 'c2a-1.0.0',
  },
  {
    id: 'ohada-opposition-injonction-10j',
    label: 'Délai d’opposition à l’injonction de payer (10 jours)',
    domain: 'ohada_recouvrement',
    status: 'verified',
    legalReferences: [
      'AUPSRVE (2023) — Art. 9 et 10',
    ],
    sourcePaths: ['ohada/AUPSRVE-2023_fr.md'],
    articles: ['9', '10'],
    notes: [
      'Opposition = recours ordinaire contre l’ordonnance d’injonction de payer.',
      'Délai : 10 jours à compter de la signification (+ délais de distance éventuels).',
    ],
    version: 'c2a-1.0.0',
  },
  {
    id: 'ohada-commandement-saisie-vente-8j',
    label: 'Commandement préalable à saisie-vente (min. 8 jours)',
    domain: 'ohada_recouvrement',
    status: 'verified',
    legalReferences: ['AUPSRVE (2023) — Art. 91 et 92'],
    sourcePaths: ['ohada/AUPSRVE-2023_fr.md'],
    articles: ['91', '92'],
    notes: [
      'Saisie-vente précédée d’un commandement de payer signifié au moins huit jours avant.',
    ],
    version: 'c2a-1.0.0',
  },
];

export function getRuleAnchor(id: string): RuleAnchor | undefined {
  return RULE_REGISTRY.find((r) => r.id === id);
}

export function listVerifiedRules(): RuleAnchor[] {
  return RULE_REGISTRY.filter((r) => r.status === 'verified');
}
