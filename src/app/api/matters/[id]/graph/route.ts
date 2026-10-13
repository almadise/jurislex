import { NextResponse } from 'next/server';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { getMatterForUser } from '@/lib/matters/service';
import { localListAnalyses } from '@/lib/auth/localDb';
import { buildMatterGraph } from '@/lib/matters/graph';
import fs from 'fs';
import path from 'path';

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

    const analyses = localListAnalyses(user.id, id);

    // Documents générés liés (store local)
    let documents: { id: string; title: string; templateId?: string }[] = [];
    try {
      const dbPath = path.join(
        process.cwd(),
        process.env.JURISLEX_LOCAL_DB || 'build/local-db.json'
      );
      if (fs.existsSync(dbPath)) {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as {
          documents?: {
            id: string;
            ownerId: string;
            matterId: string | null;
            title: string;
            templateId: string;
          }[];
        };
        documents = (db.documents || [])
          .filter((d) => d.ownerId === user.id && d.matterId === id)
          .map((d) => ({ id: d.id, title: d.title, templateId: d.templateId }));
      }
    } catch {
      documents = [];
    }

    const graph = buildMatterGraph(matter, analyses, documents);
    return NextResponse.json({ graph });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}
