import { NextResponse } from 'next/server';
import { QARequestSchema } from '@/lib/contracts/qa';
import { buildSourcedAnswer } from '@/lib/qa/buildAnswer';

/**
 * POST /api/qa
 * Body: { question, filters?, retrievalLimit?, minRetrievalScore? }
 *
 * Pipeline : retrieval hybride → génération (LLM ou extractive) →
 * post-vérification des citations (IDs corpus uniquement).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  // Compat filtres UI
  const filters =
    (raw.filters as Record<string, unknown> | undefined) ??
    (raw.domain_filter || raw.categorie
      ? {
          categories: raw.domain_filter
            ? [String(raw.domain_filter)]
            : raw.categorie
              ? [String(raw.categorie)]
              : undefined,
          jurisdictions: raw.juridiction ? [String(raw.juridiction)] : undefined,
        }
      : undefined);

  const parsed = QARequestSchema.safeParse({
    question: raw.question ?? raw.query,
    filters,
    retrievalLimit: raw.retrievalLimit ?? raw.limit ?? 12,
    minRetrievalScore: raw.minRetrievalScore ?? 35,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { erreur: 'Requête invalide', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const answer = await buildSourcedAnswer(parsed.data);
    return NextResponse.json(answer);
  } catch (e) {
    return NextResponse.json(
      { erreur: `Q&A indisponible : ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/qa',
    description:
      'Question-réponse sourcée : retrieval + génération contrainte + citations vérifiées',
    openai: Boolean(process.env.OPENAI_API_KEY?.startsWith('sk-')),
  });
}
