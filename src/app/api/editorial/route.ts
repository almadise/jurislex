import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import {
  createEditorialItem,
  enqueueFromObservatory,
  listEditorialItems,
  updateEditorialItem,
  type EditorialStatus,
} from '@/lib/observatory/editorial';
import { scanObservatory } from '@/lib/observatory/scan';
import { quarantinePaths } from '@/lib/observatory/scan';

export const runtime = 'nodejs';

const CreateSchema = z.object({
  itemType: z.enum(['document', 'relation', 'chunk', 'rule', 'source_update']),
  title: z.string().trim().min(2).max(400),
  sourcePath: z.string().optional().nullable(),
  documentSlug: z.string().optional().nullable(),
  relationId: z.string().uuid().optional().nullable(),
  ruleId: z.string().optional().nullable(),
  priority: z.number().int().optional(),
  note: z.string().max(2000).optional(),
});

const ActionSchema = z.object({
  itemId: z.string().uuid(),
  action: z.enum([
    'assign',
    'approve',
    'reject',
    'quarantine',
    'request_info',
    'note',
    'start_review',
  ]),
  note: z.string().max(2000).optional(),
  assigneeId: z.string().optional().nullable(),
  assigneeEmail: z.string().email().optional().nullable(),
  checklist: z
    .object({
      provenanceChecked: z.boolean().optional(),
      legalStatusChecked: z.boolean().optional(),
      relationsChecked: z.boolean().optional(),
      qualityChecked: z.boolean().optional(),
    })
    .optional(),
});

function canEdit(role: string | undefined): boolean {
  return role === 'admin' || role === 'reviewer';
}

/** GET /api/editorial?status=pending */
export async function GET(request: Request) {
  try {
    requireUser(await getSessionUser(request));
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as EditorialStatus | null;
    const items = listEditorialItems({
      status: status || undefined,
      limit: 200,
    });
    const totals = items.reduce(
      (acc, i) => {
        acc[i.status] = (acc[i.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    // totals sur toute la file
    const all = listEditorialItems({ limit: 500 });
    const fullTotals = all.reduce(
      (acc, i) => {
        acc[i.status] = (acc[i.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return NextResponse.json({ items, totals: fullTotals, count: items.length });
  } catch (e) {
    const statusCode = (e as Error & { status?: number }).status || 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status: statusCode });
  }
}

/**
 * POST /api/editorial
 * - create item
 * - action on item
 * - sync_observatory : importe modified/new dans la file
 */
export async function POST(request: Request) {
  try {
    const user = requireUser(await getSessionUser(request));
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
    }

    const rec = body as Record<string, unknown>;

    if (rec.op === 'sync_observatory') {
      if (!canEdit(user.role) && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ erreur: 'Droits insuffisants' }, { status: 403 });
      }
      const report = scanObservatory();
      const paths = report.items
        .filter((i) => ['modified', 'new', 'missing'].includes(i.status))
        .map((i) => ({ sourcePath: i.sourcePath, status: i.status }));
      const created = enqueueFromObservatory(paths, user.id);
      return NextResponse.json({
        ok: true,
        created: created.length,
        items: created,
        message: `${created.length} item(s) ajouté(s) à la file éditoriale`,
      });
    }

    if (rec.op === 'action' || rec.itemId) {
      if (!canEdit(user.role) && process.env.JURISLEX_AUTH_BACKEND === 'supabase') {
        return NextResponse.json({ erreur: 'Revue réservée admin/reviewer' }, { status: 403 });
      }
      const parsed = ActionSchema.safeParse({
        ...rec,
        action: rec.action || 'note',
      });
      if (!parsed.success) {
        return NextResponse.json(
          { erreur: 'Action invalide', details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const a = parsed.data;
      let status: EditorialStatus | undefined;
      let action = a.action as
        | 'assign'
        | 'approve'
        | 'reject'
        | 'quarantine'
        | 'request_info'
        | 'note';

      if (a.action === 'start_review') {
        status = 'in_review';
        action = 'assign';
      } else if (a.action === 'approve') status = 'approved';
      else if (a.action === 'reject') status = 'rejected';
      else if (a.action === 'quarantine') status = 'quarantined';
      else if (a.action === 'request_info') status = 'in_review';
      else if (a.action === 'assign') status = 'in_review';

      const item = updateEditorialItem(a.itemId, {
        status,
        action,
        note: a.note,
        byUserId: user.id,
        byEmail: user.email,
        assigneeId: a.assigneeId ?? (a.action === 'assign' || a.action === 'start_review' ? user.id : undefined),
        assigneeEmail:
          a.assigneeEmail ??
          (a.action === 'assign' || a.action === 'start_review' ? user.email : undefined),
        checklist: a.checklist,
      });
      if (!item) {
        return NextResponse.json({ erreur: 'Item introuvable' }, { status: 404 });
      }

      // Sync quarantaine corpus si source_path
      if (a.action === 'quarantine' && item.sourcePath) {
        quarantinePaths([item.sourcePath], true);
      }
      if (a.action === 'approve' && item.sourcePath) {
        quarantinePaths([item.sourcePath], false);
      }

      return NextResponse.json({ item });
    }

    // create
    if (!canEdit(user.role) && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ erreur: 'Droits insuffisants' }, { status: 403 });
    }
    const parsed = CreateSchema.safeParse(rec);
    if (!parsed.success) {
      return NextResponse.json(
        { erreur: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const item = createEditorialItem({
      ...parsed.data,
      createdBy: user.id,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    const statusCode = (e as Error & { status?: number }).status || 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status: statusCode });
  }
}
