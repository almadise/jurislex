import { NextResponse } from 'next/server';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { getIngestionJob, isIngestionAdmin } from '@/lib/ingestion/jobStore';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireUser(await getSessionUser(request));
    const { id } = await context.params;
    const job = getIngestionJob(id);
    if (!job) {
      return NextResponse.json({ erreur: 'Job introuvable' }, { status: 404 });
    }
    if (!isIngestionAdmin(user.role) && job.createdBy !== user.id) {
      return NextResponse.json({ erreur: 'Job introuvable' }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (e) {
    const status = (e as Error & { status?: number }).status || 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}
