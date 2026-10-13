import type { SearchHit } from '@/lib/contracts/search';
import { ModelAnswerSchema, type ModelAnswer } from '@/lib/contracts/qa';

const SYSTEM = `Tu es le moteur de réponse de JurisLex, plateforme juridique traçable (Cameroun / OHADA / CEMAC…).
Tu n'es PAS un chatbot généraliste.

Règles strictes :
1. Tu ne t'appuies QUE sur les SOURCES fournies (identifiants sourceId).
2. Toute affirmation juridique catégorique doit citer au moins un sourceId existant.
3. N'invente JAMAIS d'article, date, délai, autorité, montant ou procédure absents des extraits.
4. Si les sources sont insuffisantes, mode = "abstain" avec abstainReason utile.
5. Statuts d'affirmation : supported | inferred | uncertain | unsupported | conflicting.
6. Les affirmations unsupported ne doivent PAS apparaître comme conclusions dans summary/legalRule.
7. Signale les conflits entre sources et les textes manquants.
8. riskLevel : low | medium | high selon enjeux (mineurs/santé/pénal/financier → high).
9. warningMessage doit rappeler que ce n'est pas un avis d'avocat.
10. citedSourceIds et claims[].sourceIds : uniquement des sourceId de la liste fournie.
11. Réponds en français, JSON strict conforme au schéma demandé.`;

export async function generateWithLlm(
  question: string,
  hits: SearchHit[]
): Promise<{ answer: ModelAnswer; model: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.startsWith('sk-')) return null;

  const model = process.env.JURISLEX_QA_MODEL || 'gpt-4o-mini';

  const sources = hits.map((h) => ({
    sourceId: h.id,
    reference: h.reference,
    article: h.article,
    title: h.title,
    page: h.page,
    authority: h.authority,
    domain: h.domain,
    provenance: h.provenance,
    legalStatus: h.legalStatus,
    matchScore: h.matchScore,
    excerpt: h.excerpt.slice(0, 900),
  }));

  const userPayload = {
    question,
    sources,
    outputSchema: {
      mode: 'answer | abstain',
      summary: 'string',
      legalRule: 'string',
      application: 'string',
      uncertainties: 'string[]',
      conflicts: 'string[]',
      missingTexts: 'string[]',
      riskLevel: 'low | medium | high',
      warningMessage: 'string',
      claims: [{ text: 'string', status: 'supported|inferred|uncertain|unsupported|conflicting', sourceIds: ['sourceId'] }],
      citedSourceIds: ['sourceId'],
      abstainReason: 'string?',
    },
  };

  try {
    const rep = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content:
              'Produis la réponse JSON pour cette question et ces sources uniquement.\n\n' +
              JSON.stringify(userPayload),
          },
        ],
      }),
    });

    if (!rep.ok) {
      const detail = await rep.text();
      throw new Error(`LLM ${rep.status}: ${detail.slice(0, 200)}`);
    }

    const json = (await rep.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = json.choices[0]?.message?.content;
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // tentative d'extraction JSON
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return null;
      parsed = JSON.parse(m[0]);
    }

    const validated = ModelAnswerSchema.safeParse(parsed);
    if (!validated.success) {
      // tolérance : champs manquants
      const loose = parsed as Record<string, unknown>;
      const repaired = ModelAnswerSchema.safeParse({
        mode: loose.mode === 'abstain' ? 'abstain' : 'answer',
        summary: String(loose.summary ?? ''),
        legalRule: String(loose.legalRule ?? loose.legal_rule ?? ''),
        application: String(loose.application ?? ''),
        uncertainties: Array.isArray(loose.uncertainties) ? loose.uncertainties : [],
        conflicts: Array.isArray(loose.conflicts) ? loose.conflicts : [],
        missingTexts: Array.isArray(loose.missingTexts)
          ? loose.missingTexts
          : Array.isArray(loose.missing_texts)
            ? loose.missing_texts
            : [],
        riskLevel: ['low', 'medium', 'high'].includes(String(loose.riskLevel))
          ? loose.riskLevel
          : 'medium',
        warningMessage: String(
          loose.warningMessage ??
            loose.warning_message ??
            'Assistance documentaire — pas un avis juridique.'
        ),
        claims: Array.isArray(loose.claims) ? loose.claims : [],
        citedSourceIds: Array.isArray(loose.citedSourceIds)
          ? loose.citedSourceIds
          : Array.isArray(loose.cited_source_ids)
            ? loose.cited_source_ids
            : [],
        abstainReason: loose.abstainReason ? String(loose.abstainReason) : undefined,
      });
      if (!repaired.success) return null;
      return { answer: repaired.data, model };
    }

    return { answer: validated.data, model };
  } catch {
    return null;
  }
}
