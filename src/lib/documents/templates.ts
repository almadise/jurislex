import type { DocumentTemplateDef } from '@/lib/contracts/document';

/**
 * Bibliothèque de modèles documentaires versionnés (Cycle A).
 * Génération par structure + champs — pas par prompt libre seul.
 */
export const DOCUMENT_TEMPLATES: DocumentTemplateDef[] = [
  {
    id: 'tpl-mise-en-demeure',
    version: '1.0.0',
    name: 'Mise en demeure',
    description:
      "Courrier formel enjoignant un débiteur ou cocontractant à s'exécuter dans un délai déterminé.",
    icon: 'ExclamationCircleIcon',
    domain: 'Droit commercial OHADA / Droit civil',
    estimatedTime: '5 min',
    humanReviewLevel: 'recommended',
    conditions:
      'Créance ou obligation d’exécuter identifiable ; destinataire et délai clairs. Ne pas utiliser pour une saisine judiciaire.',
    fields: [
      { key: 'expediteur', label: 'Expéditeur (nom, qualité, adresse)', required: true, type: 'textarea', rows: 3, helper: 'Partie qui met en demeure.' },
      { key: 'destinataire', label: 'Destinataire (nom, qualité, adresse)', required: true, type: 'textarea', rows: 3 },
      { key: 'objet', label: 'Objet du courrier', required: true, type: 'text' },
      { key: 'montant', label: 'Montant réclamé (FCFA)', required: true, type: 'amount', helper: 'Montant principal, hors intérêts éventuels.' },
      { key: 'delai', label: 'Délai d’exécution', required: true, type: 'text', helper: 'Ex. 8 jours, 15 jours à compter de la réception.' },
      { key: 'fondement_juridique', label: 'Fondement juridique', required: true, type: 'textarea', rows: 2 },
      { key: 'faits', label: 'Rappel des faits', required: true, type: 'textarea', rows: 4 },
    ],
    structure: ['En-tête', 'Objet', 'Exposé', 'Mise en demeure', 'Réserves', 'Formule de politesse', 'Signature'],
    mandatoryClauses: [
      'Somme ou obligation clairement identifiée',
      'Délai impératif d’exécution',
      'Réserve de poursuites',
    ],
    optionalClauses: ['Offre de règlement amiable'],
    attachments: ['Pièce justificative de la créance', 'Contrat ou facture'],
    legalBasis: ['Art. 1139 Code civil', 'AUPSRVE OHADA (procédures simplifiées de recouvrement)'],
    blockingReasons: [],
    bodyTemplate: `{{expediteur}}

À l'attention de :
{{destinataire}}

Objet : MISE EN DEMEURE — {{objet}}

Monsieur, Madame,

Par la présente, je vous mets formellement en demeure de procéder à l'exécution de l'obligation suivante :

{{faits}}

En conséquence, je vous somme de régler / exécuter la somme ou prestation s'élevant à {{montant}} FCFA, dans un délai de {{delai}} à compter de la réception de la présente mise en demeure.

Fondement : {{fondement_juridique}}.

À défaut d'exécution dans le délai imparti, je me réserve le droit d'engager toutes poursuites utiles, y compris judiciaires, pour obtenir l'exécution forcée, ainsi que le cas échéant les intérêts, pénalités et frais.

La présente vaut mise en demeure au sens des dispositions applicables et fait courir les intérêts de retard s'il y a lieu.

Veuillez agréer, Monsieur, Madame, l'expression de mes salutations distinguées.

Fait à {{lieu}}, le {{date_document}}

{{expediteur}}`,
  },
  {
    id: 'tpl-lettre-reclamation',
    version: '1.0.0',
    name: 'Lettre de réclamation',
    description:
      'Courrier de réclamation commerciale ou contractuelle adressé à un fournisseur ou prestataire.',
    icon: 'EnvelopeIcon',
    domain: 'Droit commercial OHADA',
    estimatedTime: '3 min',
    humanReviewLevel: 'none',
    conditions: 'Litige commercial ou contractuel non encore contentieux ; pièces disponibles.',
    fields: [
      { key: 'expediteur', label: 'Expéditeur', required: true, type: 'textarea', rows: 3 },
      { key: 'destinataire', label: 'Destinataire', required: true, type: 'textarea', rows: 3 },
      { key: 'reference_contrat', label: 'Référence contrat / commande', required: true, type: 'text' },
      { key: 'objet_reclamation', label: 'Objet de la réclamation', required: true, type: 'textarea', rows: 4 },
      { key: 'montant', label: 'Montant concerné (FCFA)', required: true, type: 'amount' },
      { key: 'pieces_jointes', label: 'Pièces jointes', required: true, type: 'textarea', rows: 2 },
      { key: 'demande', label: 'Demande précise', required: true, type: 'textarea', rows: 3 },
    ],
    structure: ['En-tête', 'Références', 'Griefs', 'Demande', 'Pièces', 'Politesse'],
    mandatoryClauses: ['Identification du contrat', 'Description du manquement', 'Demande chiffrée ou précise'],
    attachments: ['Facture', 'Bon de commande', 'Correspondances antérieures'],
    legalBasis: ['AUDCG OHADA', 'Art. 1134 Code civil (force obligatoire des conventions)'],
    bodyTemplate: `{{expediteur}}

{{destinataire}}

Objet : Réclamation — {{reference_contrat}}

Monsieur, Madame,

Je me permets de revenir vers vous concernant le contrat / la commande {{reference_contrat}}.

Constats :
{{objet_reclamation}}

Montant en cause : {{montant}} FCFA.

En conséquence, je vous prie de bien vouloir :
{{demande}}

Pièces jointes :
{{pieces_jointes}}

Dans l'attente de votre réponse sous huit (8) jours, je vous prie d'agréer, Monsieur, Madame, l'expression de mes salutations distinguées.

Fait à {{lieu}}, le {{date_document}}

{{expediteur}}`,
  },
  {
    id: 'tpl-courrier-employeur',
    version: '1.0.0',
    name: 'Courrier à un employeur',
    description:
      'Courrier formel adressé à un employeur (réclamation, contestation, demande d’indemnités).',
    icon: 'UserGroupIcon',
    domain: 'Droit du travail',
    estimatedTime: '4 min',
    humanReviewLevel: 'recommended',
    conditions: 'Relation de travail identifiable ; faits datés ; demande claire.',
    fields: [
      { key: 'salarie', label: 'Salarié (nom, poste, embauche)', required: true, type: 'textarea', rows: 2 },
      { key: 'employeur', label: 'Employeur (raison sociale, adresse)', required: true, type: 'textarea', rows: 2 },
      { key: 'objet', label: 'Objet', required: true, type: 'text' },
      { key: 'date_faits', label: 'Date des faits', required: true, type: 'date' },
      { key: 'faits', label: 'Exposé des faits', required: true, type: 'textarea', rows: 5 },
      { key: 'demande', label: 'Demande formulée', required: true, type: 'textarea', rows: 3 },
      { key: 'fondement_juridique', label: 'Fondement (Code du travail / contrat)', required: true, type: 'textarea', rows: 2 },
    ],
    structure: ['Identités', 'Objet', 'Faits', 'Demande', 'Fondement', 'Politesse'],
    mandatoryClauses: ['Qualité de salarié', 'Date des faits', 'Demande explicite'],
    attachments: ['Contrat de travail', 'Bulletins de salaire', 'Lettre de licenciement le cas échéant'],
    legalBasis: ['Loi n° 92-007 du 14 août 1992 (Code du travail)', 'Convention collective applicable le cas échéant'],
    bodyTemplate: `{{salarie}}

À :
{{employeur}}

Objet : {{objet}}

Monsieur le Directeur, Madame la Directrice,

En ma qualité de salarié(e) au sein de votre entreprise, je me permets de vous adresser le présent courrier relatif aux faits survenus le {{date_faits}}.

{{faits}}

En conséquence, je vous prie de bien vouloir :
{{demande}}

Je fonde la présente sur : {{fondement_juridique}}.

Je reste à votre disposition pour tout entretien utile et vous prie d'agréer, Monsieur le Directeur, Madame la Directrice, l'expression de mes salutations distinguées.

Fait à {{lieu}}, le {{date_document}}

{{salarie}}`,
  },
  {
    id: 'tpl-recours-administratif',
    version: '1.0.0',
    name: 'Demande / Recours administratif',
    description:
      'Requête adressée à une autorité administrative pour contester une décision ou solliciter un acte.',
    icon: 'BuildingLibraryIcon',
    domain: 'Droit administratif',
    estimatedTime: '6 min',
    humanReviewLevel: 'recommended',
    conditions: 'Décision ou carence administrative identifiable ; qualité pour agir.',
    fields: [
      { key: 'requerant', label: 'Requérant (nom, qualité, adresse)', required: true, type: 'textarea', rows: 3 },
      { key: 'autorite', label: 'Autorité destinataire', required: true, type: 'textarea', rows: 2 },
      { key: 'objet_recours', label: 'Objet du recours', required: true, type: 'text' },
      { key: 'decision_contestee', label: 'Décision contestée (réf., date)', required: true, type: 'text' },
      { key: 'faits', label: 'Exposé des faits', required: true, type: 'textarea', rows: 5 },
      { key: 'fondement', label: 'Fondement juridique', required: true, type: 'textarea', rows: 3 },
      { key: 'demande', label: 'Demandes', required: true, type: 'textarea', rows: 3 },
    ],
    structure: ['En-tête', 'Objet', 'Faits', 'Moyens', 'Demandes', 'Pièces'],
    mandatoryClauses: ['Identification de la décision', 'Moyens de droit', 'Demandes claires'],
    attachments: ['Copie de la décision', 'Pièces d’identité', 'Preuves des griefs'],
    legalBasis: ['Droit administratif camerounais', 'Textes organiques de l’autorité saisie'],
    bodyTemplate: `{{requerant}}

À :
{{autorite}}

Objet : {{objet_recours}}
Réf. décision : {{decision_contestee}}

Monsieur, Madame,

J'ai l'honneur de former le présent recours / la présente demande aux fins suivantes.

I. — FAITS
{{faits}}

II. — MOYENS
{{fondement}}

III. — DEMANDES
{{demande}}

Je vous prie de bien vouloir statuer dans les meilleurs délais et d'agréer, Monsieur, Madame, l'expression de ma haute considération.

Fait à {{lieu}}, le {{date_document}}

{{requerant}}`,
  },
  {
    id: 'tpl-requete-saisine',
    version: '1.0.0',
    name: 'Requête / Projet de saisine',
    description:
      "Projet de requête introductive d'instance. Revue professionnelle obligatoire avant dépôt.",
    icon: 'ScaleIcon',
    domain: 'Procédure civile / OHADA',
    estimatedTime: '10 min',
    humanReviewLevel: 'required',
    conditions:
      'Projet uniquement. Ne constitue pas un acte de procédure valide sans validation professionnelle et formalités de greffe.',
    fields: [
      { key: 'demandeur', label: 'Demandeur (nom, qualité, domicile)', required: true, type: 'textarea', rows: 3 },
      { key: 'defendeur', label: 'Défendeur (nom, qualité, domicile)', required: true, type: 'textarea', rows: 3 },
      { key: 'juridiction', label: 'Juridiction saisie', required: true, type: 'text' },
      { key: 'objet', label: 'Objet de la demande', required: true, type: 'text' },
      { key: 'faits', label: 'Exposé des faits', required: true, type: 'textarea', rows: 6 },
      { key: 'moyens_droit', label: 'Moyens de droit', required: true, type: 'textarea', rows: 4 },
      { key: 'pretentions', label: 'Prétentions (chef par chef)', required: true, type: 'textarea', rows: 4 },
    ],
    structure: ['En-tête juridiction', 'Parties', 'Objet', 'Faits', 'Droit', 'Dispositif'],
    mandatoryClauses: [
      'Identification des parties',
      'Exposé des faits',
      'Moyens de droit',
      'Dispositif chiffré ou précis',
      'Avertissement projet non validé',
    ],
    attachments: ['Pièces numérotées', 'Pouvoir si représentation', 'Preuves'],
    legalBasis: ['Code de procédure civile camerounais', 'Actes uniformes OHADA le cas échéant'],
    blockingReasons: [
      'Export définitif bloqué sans confirmation de revue professionnelle',
    ],
    bodyTemplate: `PROJET DE REQUÊTE — NON DÉPOSÉ

Devant : {{juridiction}}

DEMANDEUR :
{{demandeur}}

CONTRE
DÉFENDEUR :
{{defendeur}}

Objet : {{objet}}

I. — RAPPEL DES FAITS
{{faits}}

II. — DISCUSSION EN DROIT
{{moyens_droit}}

III. — PAR CES MOTIFS
Il est demandé à la juridiction de :
{{pretentions}}

AVERTISSEMENT : Le présent document est un PROJET généré par JurisLex à des fins d'assistance documentaire. Il ne constitue pas un acte de procédure et ne doit pas être déposé sans revue et signature d'un professionnel habilité.

Fait à {{lieu}}, le {{date_document}}

{{demandeur}}`,
  },
];

export function getTemplate(id: string): DocumentTemplateDef | undefined {
  return DOCUMENT_TEMPLATES.find((t) => t.id === id);
}

export function listTemplatesPublic() {
  return DOCUMENT_TEMPLATES.map((t) => ({
    id: t.id,
    version: t.version,
    name: t.name,
    description: t.description,
    icon: t.icon,
    domain: t.domain,
    estimatedTime: t.estimatedTime,
    humanReviewLevel: t.humanReviewLevel,
    requiredFields: t.fields.filter((f) => f.required).map((f) => f.key),
    fields: t.fields,
    legalBasis: t.legalBasis,
    conditions: t.conditions,
    structure: t.structure,
    mandatoryClauses: t.mandatoryClauses,
    attachments: t.attachments,
    blockingReasons: t.blockingReasons,
  }));
}
