import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import type { GeneratedDocument } from '@/lib/contracts/document';

export async function buildDocxBuffer(doc: GeneratedDocument): Promise<Buffer> {
  const children: Paragraph[] = [];

  if (doc.watermark) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: doc.watermark,
            bold: true,
            color: 'B45309',
            size: 20,
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: doc.title.toUpperCase(), bold: true, size: 28 })],
      spacing: { after: 300 },
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Modèle ${doc.templateId} v${doc.templateVersion} — généré par JurisLex`,
          italics: true,
          size: 18,
          color: '666666',
        }),
      ],
      spacing: { after: 400 },
    })
  );

  for (const line of doc.body.split('\n')) {
    const text = line.trimEnd();
    if (!text) {
      children.push(new Paragraph({ children: [], spacing: { after: 120 } }));
      continue;
    }
    children.push(
      new Paragraph({
        children: [new TextRun({ text, size: 22, font: 'Times New Roman' })],
        spacing: { after: 80, line: 276 },
      })
    );
  }

  if (doc.legalBasis.length) {
    children.push(
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 12 },
        },
        spacing: { before: 400 },
        children: [
          new TextRun({
            text: 'Références juridiques du modèle',
            bold: true,
            size: 20,
          }),
        ],
      })
    );
    for (const ref of doc.legalBasis) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${ref}`, size: 18, font: 'Courier New' })],
          spacing: { after: 40 },
        })
      );
    }
  }

  children.push(
    new Paragraph({
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: 'Document d’assistance — aucune variable non résolue. Vérification professionnelle recommandée.',
          italics: true,
          size: 16,
          color: '666666',
        }),
      ],
    })
  );

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
