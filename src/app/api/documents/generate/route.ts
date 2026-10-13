import { NextResponse } from 'next/server';
import { GenerateDocumentRequestSchema } from '@/lib/contracts/document';
import { generateDocument } from '@/lib/documents/generate';
import { getSessionUser } from '@/lib/auth/session';
import { localSaveGeneratedDocument } from '@/lib/auth/localDb';

export const runtime = 'nodejs';

/**
 * POST /api/documents/generate
 * Valide les champs, rend le corps, refuse toute variable non résolue.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const parsed = GenerateDocumentRequestSchema.safeParse({
    templateId: raw.templateId ?? raw.template_id,
    fields: raw.fields ?? raw.form_data ?? raw.formData ?? {},
    matterId: raw.matterId ?? raw.matter_id ?? null,
    lieu: raw.lieu,
    dateDocument: raw.dateDocument ?? raw.date_document,
    confirmProfessionalReview:
      raw.confirmProfessionalReview ?? raw.confirm_professional_review ?? false,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { erreur: 'Requête invalide', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const doc = generateDocument(parsed.data);
    const user = await getSessionUser(request);
    if (user) {
      try {
        localSaveGeneratedDocument({
          ownerId: user.id,
          matterId: parsed.data.matterId ?? null,
          document: doc,
        });
      } catch {
        /* non bloquant */
      }
    }
    return NextResponse.json({ document: doc });
  } catch (e) {
    const err = e as Error & { status?: number; missing?: string[]; empty?: string[]; unresolved?: string[] };
    return NextResponse.json(
      {
        erreur: err.message,
        missing: err.missing,
        empty: err.empty,
        unresolved: err.unresolved,
      },
      { status: err.status ?? 500 }
    );
  }
}
