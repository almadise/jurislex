import type { GeneratedDocument } from '@/lib/contracts/document';

/**
 * Générateur PDF minimal sans dépendance native (compatible Next.js / Windows).
 */

function toPdfSafe(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2022/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
}

function wrapLine(line: string, max = 95): string[] {
  if (line.length <= max) return [line];
  const words = line.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function buildContentStream(lines: string[]): string {
  const pageHeight = 842;
  const marginLeft = 50;
  const marginTop = 50;
  const lineHeight = 12;
  const fontSize = 10;
  let y = pageHeight - marginTop;
  let stream = `BT\n/F1 ${fontSize} Tf\n`;
  for (const line of lines) {
    stream += `1 0 0 1 ${marginLeft} ${y} Tm\n(${line}) Tj\n`;
    y -= lineHeight;
  }
  stream += 'ET\n';
  return stream;
}

export async function buildPdfBuffer(doc: GeneratedDocument): Promise<Buffer> {
  const lines: string[] = [];
  if (doc.watermark) {
    lines.push(toPdfSafe(doc.watermark), '');
  }
  lines.push(toPdfSafe(doc.title.toUpperCase()), '');
  lines.push(toPdfSafe(`Modele ${doc.templateId} v${doc.templateVersion} - JurisLex`), '');

  for (const raw of doc.body.split('\n')) {
    const safe = toPdfSafe(raw);
    if (!safe.trim()) {
      lines.push('');
      continue;
    }
    lines.push(...wrapLine(safe, 95));
  }

  if (doc.legalBasis.length) {
    lines.push('', 'References juridiques du modele:');
    for (const ref of doc.legalBasis) {
      lines.push(toPdfSafe(`- ${ref}`));
    }
  }
  lines.push(
    '',
    toPdfSafe(
      "Document d'assistance - aucune variable non resolue. Verification professionnelle recommandee."
    )
  );

  const maxLinesPerPage = 60;
  const pageChunks: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pageChunks.push(lines.slice(i, i + maxLinesPerPage));
  }
  if (!pageChunks.length) pageChunks.push(['(document vide)']);

  /*
   * Object graph:
   * 1 Catalog
   * 2 Pages
   * 3 Font
   * then pairs (content, page) for each page
   */
  const objs: string[] = [];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>'); // 1
  objs.push('PLACEHOLDER_PAGES'); // 2
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 3

  const pageIds: number[] = [];
  for (const chunk of pageChunks) {
    const stream = buildContentStream(chunk);
    const contentObjNum = objs.length + 1;
    objs.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}endstream`);
    const pageObjNum = objs.length + 1;
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    );
    pageIds.push(pageObjNum);
  }

  objs[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
