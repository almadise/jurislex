import { NextResponse } from 'next/server';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { localListAnalyses } from '@/lib/auth/localDb';

export const runtime = 'nodejs';

/** GET /api/analysis?matterId= — analyses de l'utilisateur (option filtrée dossier) */
export async function GET(request: Request) {
  try {
    const user = requireUser(await getSessionUser(request));
    const url = new URL(request.url);
    const matterId = url.searchParams.get('matterId') || undefined;
    const rows = localListAnalyses(user.id, matterId);
    return NextResponse.json({
      analyses: rows.map((r) => ({
        id: r.id,
        matterId: r.matterId,
        createdAt: r.createdAt,
        narrativePreview: r.narrative.slice(0, 160),
        analysis: r.analysis,
      })),
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}
