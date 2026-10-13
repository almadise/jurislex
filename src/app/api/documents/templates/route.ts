import { NextResponse } from 'next/server';
import { listTemplatesPublic, getTemplate } from '@/lib/documents/templates';

export const runtime = 'nodejs';

/** GET /api/documents/templates — liste des 5 modèles versionnés */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const t = getTemplate(id);
    if (!t) {
      return NextResponse.json({ erreur: 'Modèle introuvable' }, { status: 404 });
    }
    return NextResponse.json({ template: listTemplatesPublic().find((x) => x.id === id) });
  }
  return NextResponse.json({ templates: listTemplatesPublic() });
}
