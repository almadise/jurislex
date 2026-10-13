import { NextResponse } from 'next/server';
import { ExportDocumentRequestSchema } from '@/lib/contracts/document';
import { generateDocument } from '@/lib/documents/generate';
import { buildDocxBuffer } from '@/lib/documents/exportDocx';
import { buildPdfBuffer } from '@/lib/documents/exportPdf';
import { getSessionUser } from '@/lib/auth/session';
import { localSaveGeneratedDocument } from '@/lib/auth/localDb';

export const runtime = 'nodejs';

/**
 * POST /api/documents/export
 * { templateId, fields, format: 'docx'|'pdf', confirmProfessionalReview? }
 * Refuse l'export si variables non résolues ou revue obligatoire non confirmée.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const parsed = ExportDocumentRequestSchema.safeParse({
    templateId: raw.templateId ?? raw.template_id,
    fields: raw.fields ?? raw.form_data ?? raw.formData ?? {},
    format: raw.format,
    lieu: raw.lieu,
    dateDocument: raw.dateDocument ?? raw.date_document,
    confirmProfessionalReview:
      raw.confirmProfessionalReview ?? raw.confirm_professional_review ?? false,
    matterId: raw.matterId ?? null,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { erreur: 'Requête invalide', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const doc = generateDocument({
      templateId: parsed.data.templateId,
      fields: parsed.data.fields,
      lieu: parsed.data.lieu,
      dateDocument: parsed.data.dateDocument,
      confirmProfessionalReview: parsed.data.confirmProfessionalReview,
      matterId: parsed.data.matterId,
    });

    if (doc.blocked) {
      return NextResponse.json(
        {
          erreur: doc.blockReason || 'Export bloqué',
          blocked: true,
          humanReviewLevel: doc.humanReviewLevel,
        },
        { status: 403 }
      );
    }

    if (doc.unresolvedPlaceholders.length > 0) {
      return NextResponse.json(
        {
          erreur: 'Variables non résolues',
          unresolved: doc.unresolvedPlaceholders,
        },
        { status: 422 }
      );
    }

    const user = await getSessionUser(request);
    if (user) {
      try {
        localSaveGeneratedDocument({
          ownerId: user.id,
          matterId: parsed.data.matterId ?? null,
          document: doc,
          format: parsed.data.format,
        });
      } catch {
        /* ignore */
      }
    }

    const safeName = `${doc.templateId}-${doc.id.slice(0, 8)}`.replace(/[^\w.-]+/g, '_');

    if (parsed.data.format === 'docx') {
      const buf = await buildDocxBuffer(doc);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeName}.docx"`,
          'X-JurisLex-Document-Id': doc.id,
          'X-JurisLex-Unresolved': '0',
        },
      });
    }

    const buf = await buildPdfBuffer(doc);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        'X-JurisLex-Document-Id': doc.id,
        'X-JurisLex-Unresolved': '0',
      },
    });
  } catch (e) {
    const err = e as Error & { status?: number; unresolved?: string[] };
    console.error('[documents/export]', err);
    return NextResponse.json(
      { erreur: err.message, unresolved: err.unresolved },
      { status: err.status ?? 500 }
    );
  }
}
