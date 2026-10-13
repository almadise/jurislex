import type { SearchHit } from '@/lib/contracts/search';
import type { ModelAnswer } from '@/lib/contracts/qa';

/**
 * Réponse extractive (sans LLM) : structure honnête fondée uniquement
 * sur les dispositions récupérées. Aucune règle inventée.
 */
export function buildExtractiveAnswer(question: string, hits: SearchHit[]): ModelAnswer {
  if (!hits.length) {
    return abstain(
      question,
      'Aucune disposition pertinente n’a été retrouvée dans le corpus indexé pour cette question.'
    );
  }

  const top = hits.slice(0, 6);
  const strong = top.filter((h) => h.matchScore >= 45);

  if (!strong.length) {
    return {
      ...abstain(
        question,
        'Des extraits ont été trouvés mais leur score de correspondance est trop faible pour fonder une réponse juridique.'
      ),
      missingTexts: [
        'Textes plus spécifiques à la question posée (non identifiés avec un score suffisant)',
      ],
      citedSourceIds: top.slice(0, 3).map((h) => h.id),
      claims: top.slice(0, 3).map((h) => ({
        text: `Extrait candidate : ${h.article} — ${h.title}`,
        status: 'uncertain' as const,
        sourceIds: [h.id],
      })),
    };
  }

  const bullets = strong.map((h, i) => {
    const ref = [h.reference, h.article].filter(Boolean).join(' — ');
    const snippet = h.excerpt.slice(0, 280).replace(/\s+/g, ' ').trim();
    return `(${i + 1}) ${ref} : « ${snippet}${h.excerpt.length > 280 ? '…' : ''} »`;
  });

  const summary =
    `Sur la base de ${strong.length} disposition(s) récupérée(s) dans le corpus (moteur extractif, sans génération libre), ` +
    `les textes les plus proches de votre question sont : ` +
    strong
      .slice(0, 3)
      .map((h) => `${h.article} (${h.reference})`)
      .join(', ') +
    `. Lisez les extraits ci-dessous ; aucune règle non présente dans ces sources n’est affirmée.`;

  const legalRule = bullets.join('\n\n');

  const application =
    `Application prudente : ces extraits sont fournis tels qu’indexés. ` +
    `Vérifiez le champ d’application, les conditions et les délais dans le texte intégral (page indiquée). ` +
    `Sans modèle de langage configuré, JurisLex n’infère pas de procédure ni de montant non écrits dans les extraits.`;

  const uncertainties = [
    'Réponse extractive : pas de synthèse juridique générative — uniquement les dispositions rankées.',
    'Le statut « en vigueur » des textes n’est pas garanti (legal_status souvent unknown).',
    ...(strong.some((h) => h.provenance === 'secondary')
      ? ['Au moins une source secondaire figure parmi les résultats.']
      : []),
  ];

  const missingTexts = [
    'Jurisprudence et conventions collectives non couvertes sauf si présentes dans le corpus.',
    'Textes modificatifs ou d’application absents de l’index local/Supabase le cas échéant.',
  ];

  return {
    mode: 'answer',
    summary,
    legalRule,
    application,
    uncertainties,
    conflicts: [],
    missingTexts,
    riskLevel: 'medium',
    warningMessage:
      'Assistance documentaire uniquement — pas un avis d’avocat. Configurez OPENAI_API_KEY pour une synthèse structurée ; ' +
      'dans tous les cas, chaque citation ci-contre renvoie à une disposition réellement récupérée.',
    claims: strong.map((h) => ({
      text: `${h.article} — ${h.title}`,
      status: h.matchScore >= 70 ? ('supported' as const) : ('inferred' as const),
      sourceIds: [h.id],
    })),
    citedSourceIds: strong.map((h) => h.id),
  };
}

function abstain(question: string, reason: string): ModelAnswer {
  return {
    mode: 'abstain',
    summary: `Abstention utile : ${reason}`,
    legalRule:
      'Aucune règle de droit n’est affirmée faute de fondement suffisant dans le corpus récupéré.',
    application:
      'Prochaines étapes : reformuler la question, élargir les filtres, vérifier que le texte attendu est bien ingéré ' +
      '(scripts/02_extract.py / upload Supabase), ou transmettre le dossier à un professionnel.',
    uncertainties: [reason],
    conflicts: [],
    missingTexts: [
      'Sources officielles complémentaires non indexées pour cette question',
      'Éventuels décrets d’application ou jurisprudence',
    ],
    riskLevel: 'high',
    warningMessage:
      'Mode hors réponse : JurisLex refuse de conclure sans disposition vérifiable. ' +
      'Ceci n’est pas un avis juridique.',
    claims: [],
    citedSourceIds: [],
    abstainReason: reason,
  };
}
