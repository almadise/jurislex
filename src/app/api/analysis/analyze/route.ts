import { NextResponse } from 'next/server';
import { AnalyzeRequestSchema } from '@/lib/contracts/analysis';
import { runFullAnalysis } from '@/lib/analysis/runAnalysis';
import { getSessionUser } from '@/lib/auth/session';
import { localSaveAnalysis } from '@/lib/auth/localDb';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/analysis/analyze
 * { narrative, factObject?, answers?, matterId?, skipClarification? }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const parsed = AnalyzeRequestSchema.safeParse({
    narrative: raw.narrative ?? raw.fact_narrative,
    factObject: raw.factObject ?? raw.fact_object,
    answers: raw.answers ?? {},
    matterId: raw.matterId ?? raw.matter_id ?? null,
    skipClarification: raw.skipClarification ?? false,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { erreur: 'Requête invalide', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const analysis = await runFullAnalysis({
      narrative: parsed.data.narrative,
      factObject: parsed.data.factObject,
      answers: parsed.data.answers,
      matterId: parsed.data.matterId,
    });

    // Persistance si session (avec ou sans dossier)
    const user = await getSessionUser(request);
    let savedId: string | null = null;
    let saveError: string | undefined;
    if (user) {
      try {
        const row = localSaveAnalysis({
          ownerId: user.id,
          matterId: parsed.data.matterId ?? null,
          narrative: parsed.data.narrative,
          analysis,
          analysisId: analysis.id,
        });
        savedId = row.id;
      } catch (e) {
        saveError = (e as Error).message;
      }
    }

    return NextResponse.json({
      analysis,
      saved: Boolean(savedId),
      analysisId: savedId || analysis.id,
      saveError,
      linkedMatterId: parsed.data.matterId ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { erreur: `Analyse impossible : ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
