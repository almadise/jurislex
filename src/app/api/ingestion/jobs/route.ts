import { NextResponse } from 'next/server';
import { CreateIngestionJobSchema } from '@/lib/contracts/ingestion';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import {
  createIngestionJob,
  isIngestionAdmin,
  listIngestionJobs,
} from '@/lib/ingestion/jobStore';

export const runtime = 'nodejs';

/**
 * GET /api/ingestion/jobs — liste les jobs (admin/reviewer : tous ; sinon : siens).
 * POST /api/ingestion/jobs — enqueue un job (admin/reviewer uniquement en prod).
 */
export async function GET(request: Request) {
  try {
    const user = requireUser(await getSessionUser(request));
    const all = listIngestionJobs(100);
    const jobs = isIngestionAdmin(user.role)
      ? all
      : all.filter((j) => j.createdBy === user.id);
    return NextResponse.json({ jobs, count: jobs.length });
  } catch (e) {
    const status = (e as Error & { status?: number }).status || 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = requireUser(await getSessionUser(request));
    // En local dev, un utilisateur connecté peut enqueuer ; en prod, admin/reviewer.
    const prodStrict =
      process.env.JURISLEX_AUTH_BACKEND === 'supabase' ||
      process.env.NODE_ENV === 'production';
    if (prodStrict && !isIngestionAdmin(user.role)) {
      return NextResponse.json(
        { erreur: 'Ingestion réservée aux rôles admin / reviewer' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
    }

    const parsed = CreateIngestionJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { erreur: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const job = await createIngestionJob(parsed.data, user.id);
    return NextResponse.json(
      {
        job,
        message: process.env.REDIS_URL
          ? 'Job enfilé (Redis) — le worker le traitera'
          : 'Job enregistré localement — lancer le worker avec REDIS_URL ou python scripts/worker.py --once',
      },
      { status: 201 }
    );
  } catch (e) {
    const status = (e as Error & { status?: number }).status || 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}
