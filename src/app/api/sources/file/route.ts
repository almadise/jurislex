import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * GET /api/sources/file?path=18_Securite_sociale/...pdf
 * Sert un PDF du corpus legal-content/ (lecture seule, path traversal bloqué).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rel = url.searchParams.get('path') || '';
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) {
    return NextResponse.json({ erreur: 'Chemin invalide' }, { status: 400 });
  }

  const normalized = rel.replace(/\\/g, '/').replace(/^\/+/, '');
  const root = path.join(process.cwd(), 'legal-content');
  const full = path.resolve(root, normalized);

  if (!full.startsWith(path.resolve(root))) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    // Essai sous _ocr/
    const ocr = path.resolve(root, '_ocr', normalized);
    if (fs.existsSync(ocr) && ocr.startsWith(path.resolve(root))) {
      return serveFile(ocr, normalized);
    }
    return NextResponse.json({ erreur: 'Fichier introuvable', path: normalized }, { status: 404 });
  }

  return serveFile(full, normalized);
}

function serveFile(full: string, rel: string) {
  const buf = fs.readFileSync(full);
  const ext = path.extname(full).toLowerCase();
  const type =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.md'
        ? 'text/markdown; charset=utf-8'
        : 'application/octet-stream';

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Disposition': `inline; filename="${path.basename(rel)}"`,
      'Cache-Control': 'private, max-age=300',
      'X-JurisLex-Source-Path': rel,
    },
  });
}
