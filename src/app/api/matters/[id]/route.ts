import { NextResponse } from 'next/server';
import { UpdateMatterSchema } from '@/lib/contracts/matter';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import {
  deleteMatterForUser,
  exportMatterForUser,
  getMatterForUser,
  toUiMatter,
  updateMatterForUser,
} from '@/lib/matters/service';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const user = requireUser(await getSessionUser(request));
    const { id } = await ctx.params;
    const matter = getMatterForUser(user, id);
    if (!matter) {
      return NextResponse.json(
        { erreur: 'Dossier introuvable ou accès refusé' },
        { status: 404 }
      );
    }
    return NextResponse.json({ matter: toUiMatter(matter) });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = requireUser(await getSessionUser(request));
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
    }
    const parsed = UpdateMatterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { erreur: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const matter = updateMatterForUser(user, id, parsed.data);
    if (!matter) {
      return NextResponse.json(
        { erreur: 'Dossier introuvable ou accès refusé' },
        { status: 404 }
      );
    }
    return NextResponse.json({ matter: toUiMatter(matter) });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = requireUser(await getSessionUser(request));
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const hard = url.searchParams.get('hard') === '1';

    if (hard) {
      const ok = deleteMatterForUser(user, id);
      if (!ok) {
        return NextResponse.json(
          { erreur: 'Dossier introuvable ou accès refusé' },
          { status: 404 }
        );
      }
      return NextResponse.json({ deleted: true });
    }

    // Soft delete = archive
    const matter = updateMatterForUser(user, id, { status: 'archived' });
    if (!matter) {
      return NextResponse.json(
        { erreur: 'Dossier introuvable ou accès refusé' },
        { status: 404 }
      );
    }
    return NextResponse.json({ matter: toUiMatter(matter) });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}

/** Export JSON du dossier (audité). */
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const user = requireUser(await getSessionUser(request));
    const { id } = await ctx.params;
    const url = new URL(request.url);
    if (url.searchParams.get('export') !== '1') {
      return NextResponse.json({ erreur: 'Utiliser ?export=1' }, { status: 400 });
    }
    const matter = exportMatterForUser(user, id);
    if (!matter) {
      return NextResponse.json(
        { erreur: 'Dossier introuvable ou accès refusé' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      export: matter,
      exportedAt: new Date().toISOString(),
      note: 'Export propriétaire uniquement — données sensibles.',
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}
