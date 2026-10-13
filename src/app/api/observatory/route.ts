import { NextResponse } from 'next/server';
import {
  quarantinePaths,
  scanObservatory,
} from '@/lib/observatory/scan';
import { getSessionUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** GET /api/observatory — scan corpus vs index */
export async function GET() {
  try {
    const report = scanObservatory();
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { erreur: `Observatoire : ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/observatory
 * { action: 'quarantine'|'release', paths: string[] }
 * Réservé admin si session présente avec role admin ; sinon autorisé en local dev.
 */
export async function POST(request: Request) {
  let body: { action?: string; paths?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const user = await getSessionUser(request);
  if (user && user.role !== 'admin' && user.role !== 'reviewer') {
    return NextResponse.json({ erreur: 'Droits insuffisants' }, { status: 403 });
  }

  const paths = body.paths || [];
  if (!paths.length) {
    return NextResponse.json({ erreur: 'paths requis' }, { status: 400 });
  }

  if (body.action === 'quarantine') {
    const list = quarantinePaths(paths, true);
    return NextResponse.json({
      ok: true,
      quarantine: list,
      message: `${paths.length} source(s) en quarantaine — réponses/modèles affectés à valider.`,
    });
  }
  if (body.action === 'release') {
    const list = quarantinePaths(paths, false);
    return NextResponse.json({ ok: true, quarantine: list });
  }

  return NextResponse.json({ erreur: 'action inconnue' }, { status: 400 });
}
