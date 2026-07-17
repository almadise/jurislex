import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,  } from 'docx';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateName, documentContent, citations, warnings } = body as {
      templateName: string;
      documentContent: string;
      citations: { reference: string; usage: string }[];
      warnings: { type: string; message: string }[];
    };

    if (!documentContent) {
      return NextResponse.json({ error: 'documentContent is required' }, { status: 400 });
    }

    // Split content into paragraphs
    const contentLines = documentContent.split('\n');

    const contentParagraphs: Paragraph[] = contentLines.map((line) => {
      const trimmed = line.trim();
      // Detect heading-like lines (all caps, short)
      if (trimmed.length > 0 && trimmed === trimmed.toUpperCase() && trimmed.length < 80 && !trimmed.includes('.')) {
        return new Paragraph({
          children: [new TextRun({ text: trimmed, bold: true, size: 24 })],
          spacing: { before: 240, after: 120 },
        });
      }
      return new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 80 },
      });
    });

    // Citations section
    const citationParagraphs: Paragraph[] = [];
    if (citations && citations.length > 0) {
      citationParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: 'RÉFÉRENCES JURIDIQUES', bold: true, size: 22 })],
          spacing: { before: 400, after: 160 },
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: '1E3A5F' } },
        })
      );
      citations.forEach((c) => {
        citationParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${c.reference} — `, bold: true, size: 20, color: '1E3A5F' }),
              new TextRun({ text: c.usage, size: 20 }),
            ],
            spacing: { after: 80 },
          })
        );
      });
    }

    // Warnings section
    const warningParagraphs: Paragraph[] = [];
    if (warnings && warnings.length > 0) {
      warningParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: 'AVERTISSEMENTS', bold: true, size: 22, color: 'B45309' })],
          spacing: { before: 400, after: 160 },
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'B45309' } },
        })
      );
      warnings.forEach((w) => {
        warningParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `⚠ ${w.message}`, size: 20, color: 'B45309' })],
            spacing: { after: 80 },
          })
        );
      });
    }

    const doc = new Document({
      creator: 'JurisLex',
      title: templateName,
      description: `Document généré par JurisLex — ${templateName}`,
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children: [
            // Header
            new Paragraph({
              children: [
                new TextRun({ text: 'JURISLEX', bold: true, size: 28, color: '1E3A5F' }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Document généré — Projet à valider', size: 18, color: '6B7280', italics: true }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            // Title
            new Paragraph({
              children: [new TextRun({ text: templateName.toUpperCase(), bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 },
            }),
            // Document content
            ...contentParagraphs,
            // Citations
            ...citationParagraphs,
            // Warnings
            ...warningParagraphs,
            // Footer note
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Ce document a été généré automatiquement par JurisLex à partir du corpus juridique camerounais et OHADA. Il ne constitue pas un avis juridique et doit être validé par un professionnel du droit avant tout usage officiel.',
                  size: 16,
                  color: '9CA3AF',
                  italics: true,
                }),
              ],
              spacing: { before: 600 },
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } },
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    const filename = `${templateName.replace(/[^a-zA-Z0-9]/g, '_')}_JurisLex.docx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la génération DOCX';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
