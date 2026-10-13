import { NextResponse } from 'next/server';
import { ExtractFactsRequestSchema } from '@/lib/contracts/analysis';
import { extractFactsPhase } from '@/lib/analysis/runAnalysis';

export const runtime = 'nodejs';

/**
 * POST /api/analysis/extract-facts
 * { narrative, matterId? }
 * → factObject + questions de clarification (impact qualif/délai/preuve/…)
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const parsed = ExtractFactsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { erreur: 'Récit trop court ou invalide (min. 20 caractères)', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = extractFactsPhase(parsed.data.narrative);
    return NextResponse.json({
      factObject: result.factObject,
      questions: result.questions,
      needsClarification: result.questions.length > 0,
      warning:
        'Extraction par règles déterministes — les hypothèses sont séparées des faits utilisateur.',
    });
  } catch (e) {
    return NextResponse.json(
      { erreur: `Extraction impossible : ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
