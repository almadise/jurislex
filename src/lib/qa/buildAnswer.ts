import type { SearchFilters } from '@/lib/contracts/search';
import type { QARequest, QAResponse } from '@/lib/contracts/qa';
import { runSearch } from '@/lib/search/runSearch';
import { buildExtractiveAnswer } from './extractiveAnswer';
import { generateWithLlm } from './llmGenerate';
import { sanitizeConclusions, verifyAndBuildCitations } from './verifyCitations';

const DEFAULT_WARNING =
  'JurisLex fournit une assistance documentaire fondée sur le corpus indexé, non une garantie de résultat ni un avis d’avocat. ' +
  'Revue professionnelle recommandée avant toute décision ou acte.';

export async function buildSourcedAnswer(input: QARequest): Promise<QAResponse> {
  const warnings: string[] = [];
  const question = input.question.trim();
  const filters: SearchFilters | undefined = input.filters;
  const limit = input.retrievalLimit ?? 12;
  const minScore = input.minRetrievalScore ?? 35;

  // Retrieval hybride (exact boost inclus dans runSearch hybrid)
  const retrieval = await runSearch({
    query: question,
    mode: 'hybrid',
    filters,
    limit,
  });

  warnings.push(...(retrieval.warnings ?? []));

  let hits = retrieval.resultats;
  const bestScore = hits[0]?.matchScore ?? 0;

  // Filtrer les hits trop faibles pour fonder une réponse
  const usable = hits.filter((h) => h.matchScore >= minScore);
  if (usable.length > 0) {
    hits = usable;
  }

  // Génération
  let engine: QAResponse['generation']['engine'] = 'none';
  let modelName: string | undefined;
  let modelAnswer = buildExtractiveAnswer(question, hits);

  if (hits.length > 0) {
    const llm = await generateWithLlm(question, hits);
    if (llm) {
      modelAnswer = llm.answer;
      engine = 'llm';
      modelName = llm.model;
    } else {
      engine = 'extractive';
      warnings.push(
        'OPENAI_API_KEY absente ou LLM indisponible — réponse extractive (dispositions rankées, sans synthèse générative libre).'
      );
    }
  } else {
    engine = 'extractive';
    modelAnswer = buildExtractiveAnswer(question, []);
  }

  // Abstention si retrieval trop faible même avec LLM
  if (hits.length === 0 || (bestScore < minScore && modelAnswer.mode === 'answer' && engine === 'extractive')) {
    if (hits.length === 0) {
      modelAnswer = buildExtractiveAnswer(question, []);
    }
  }

  const verification = verifyAndBuildCitations(modelAnswer, hits);
  const sanitized = sanitizeConclusions(modelAnswer, verification);

  let mode = modelAnswer.mode;
  let summary = sanitized.summary;
  let legalRule = sanitized.legalRule;
  let application = sanitized.application;

  if (sanitized.forceAbstain) {
    mode = 'abstain';
    if (!summary) {
      summary =
        'Abstention utile : les sources récupérées ne permettent pas une conclusion juridique fiable.';
    }
    if (!legalRule) {
      legalRule =
        'Aucune règle de droit n’est affirmée faute de citation vérifiée rattachée au corpus.';
    }
    if (!application) {
      application =
        'Indiquez la référence exacte d’un texte, élargissez le corpus, ou consultez un professionnel.';
    }
  }

  if (verification.rejectedFakeCitations > 0) {
    warnings.push(
      `${verification.rejectedFakeCitations} référence(s) de citation rejetée(s) (identifiant hors corpus récupéré).`
    );
  }
  if (verification.rejectedUnsupportedClaims > 0) {
    warnings.push(
      `${verification.rejectedUnsupportedClaims} affirmation(s) unsupported écartée(s) des conclusions.`
    );
  }
  if (verification.strippedUnsupported.length) {
    warnings.push('Des affirmations non fondées ont été isolées et ne figurent pas comme conclusions.');
  }

  // Toute citation affichée est verified:true (post-check)
  const citations = verification.citations.filter((c) => c.verified);

  // En mode answer, au moins une citation vérifiée est obligatoire
  if (mode === 'answer' && citations.length === 0) {
    mode = 'abstain';
    summary =
      'Abstention : une réponse avait été produite sans citation vérifiable — elle n’est pas affichée comme conclusion.';
    legalRule = 'Aucune disposition récupérée n’a pu être reliée de façon vérifiable.';
    application = 'Relancez la recherche ou vérifiez l’ingestion du corpus.';
    warnings.push('Réponse rétrogradée en abstention (zéro citation vérifiée).');
  }

  const riskLevel =
    mode === 'abstain' ? 'high' : modelAnswer.riskLevel || 'medium';

  const response: QAResponse = {
    question,
    mode,
    summary,
    legalRule,
    application,
    uncertainties: modelAnswer.uncertainties ?? [],
    conflicts: modelAnswer.conflicts ?? [],
    riskLevel,
    warningMessage: modelAnswer.warningMessage || DEFAULT_WARNING,
    citations,
    missingTexts: modelAnswer.missingTexts ?? [],
    assertions: verification.assertions,
    retrieval: {
      backend: retrieval.backend,
      effectiveMode: retrieval.effectiveMode,
      hitCount: retrieval.resultats.length,
      warnings: retrieval.warnings ?? [],
    },
    generation: {
      engine,
      model: modelName,
      rejectedUnsupportedClaims: verification.rejectedUnsupportedClaims,
      rejectedFakeCitations: verification.rejectedFakeCitations,
    },
    warnings,
  };

  return response;
}
