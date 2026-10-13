import type { SearchHit } from '@/lib/contracts/search';
import type {
  ClaimStatus,
  ModelAnswer,
  QAAssertion,
  QACitation,
} from '@/lib/contracts/qa';

export interface VerificationResult {
  citations: QACitation[];
  assertions: QAAssertion[];
  rejectedFakeCitations: number;
  rejectedUnsupportedClaims: number;
  /** Affirmations unsupported retirées des conclusions. */
  strippedUnsupported: string[];
}

/**
 * Post-vérification CDC :
 * - toute citation doit pointer vers un hit récupéré (sourceId existant)
 * - les affirmations `unsupported` ne deviennent pas des conclusions
 * - les sourceIds inventés sont rejetés
 */
export function verifyAndBuildCitations(
  model: ModelAnswer,
  hits: SearchHit[]
): VerificationResult {
  const byId = new Map(hits.map((h) => [h.id, h]));
  let rejectedFakeCitations = 0;
  let rejectedUnsupportedClaims = 0;
  const strippedUnsupported: string[] = [];

  const citedIds = new Set<string>();
  for (const id of model.citedSourceIds) {
    if (byId.has(id)) citedIds.add(id);
    else rejectedFakeCitations += 1;
  }
  for (const claim of model.claims) {
    for (const id of claim.sourceIds) {
      if (byId.has(id)) citedIds.add(id);
      else rejectedFakeCitations += 1;
    }
  }

  // Si le modèle n'a rien cité mais on a des hits et une réponse, citer les top hits
  if (citedIds.size === 0 && model.mode === 'answer' && hits.length > 0) {
    hits.slice(0, Math.min(5, hits.length)).forEach((h) => citedIds.add(h.id));
  }

  const citations: QACitation[] = [];
  let i = 0;
  for (const id of citedIds) {
    const hit = byId.get(id)!;
    i += 1;
    const claimStatus = inferCitationClaimStatus(id, model, hit);
    citations.push({
      id: `cit-${i}-${id}`.slice(0, 80),
      sourceId: id,
      chunkId: hit.chunkId,
      documentId: hit.documentId,
      reference: hit.reference,
      article: hit.article,
      title: hit.title,
      excerpt: hit.excerpt,
      page: hit.page ?? 0,
      authority: hit.authority,
      legalStatus: hit.legalStatus,
      claimStatus,
      domain: hit.domain,
      provenance: hit.provenance,
      sourcePath: hit.sourcePath,
      matchScore: hit.matchScore,
      verified: true,
    });
  }

  const sourceIdToCitId = new Map(citations.map((c) => [c.sourceId, c.id]));

  const assertions: QAAssertion[] = [];
  for (const claim of model.claims) {
    const validSourceIds = claim.sourceIds.filter((id) => byId.has(id));
    const fake = claim.sourceIds.length - validSourceIds.length;
    rejectedFakeCitations += fake;

    let status: ClaimStatus = claim.status;

    if (status === 'unsupported') {
      rejectedUnsupportedClaims += 1;
      strippedUnsupported.push(claim.text);
      // On conserve l'affirmation comme incertaine documentée, pas comme conclusion
      status = 'unsupported';
      assertions.push({
        text: claim.text,
        status,
        citationIds: [],
      });
      continue;
    }

    if (validSourceIds.length === 0 && (status === 'supported' || status === 'inferred')) {
      // Soutien inventé → rétrograder
      status = 'uncertain';
      rejectedFakeCitations += 1;
    }

    assertions.push({
      text: claim.text,
      status,
      citationIds: validSourceIds
        .map((id) => sourceIdToCitId.get(id))
        .filter((x): x is string => Boolean(x)),
    });
  }

  return {
    citations,
    assertions,
    rejectedFakeCitations,
    rejectedUnsupportedClaims,
    strippedUnsupported,
  };
}

function inferCitationClaimStatus(
  sourceId: string,
  model: ModelAnswer,
  hit: SearchHit
): ClaimStatus {
  const linked = model.claims.filter((c) => c.sourceIds.includes(sourceId));
  if (linked.some((c) => c.status === 'conflicting')) return 'conflicting';
  if (linked.some((c) => c.status === 'supported')) return 'supported';
  if (linked.some((c) => c.status === 'inferred')) return 'inferred';
  if (linked.some((c) => c.status === 'uncertain')) return 'uncertain';
  if (hit.matchScore >= 70) return 'supported';
  if (hit.matchScore >= 45) return 'inferred';
  return 'uncertain';
}

/**
 * Garantit qu'aucune conclusion principale n'est purement unsupported.
 * Si summary/legalRule vides après nettoyage → abstention.
 */
export function sanitizeConclusions(
  model: ModelAnswer,
  verification: VerificationResult
): { summary: string; legalRule: string; application: string; forceAbstain: boolean } {
  let summary = model.summary.trim();
  let legalRule = model.legalRule.trim();
  let application = model.application.trim();

  // Retirer les phrases unsupported connues des blocs principaux
  for (const bad of verification.strippedUnsupported) {
    const needle = bad.trim();
    if (needle.length < 12) continue;
    summary = summary.replace(needle, '').trim();
    legalRule = legalRule.replace(needle, '').trim();
    application = application.replace(needle, '').trim();
  }

  const forceAbstain =
    model.mode === 'abstain' ||
    (verification.citations.length === 0 && model.mode === 'answer') ||
    (summary.length < 20 && legalRule.length < 20);

  return { summary, legalRule, application, forceAbstain };
}
