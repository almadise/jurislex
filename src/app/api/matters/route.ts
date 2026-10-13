import { NextResponse } from 'next/server';
import { CreateMatterSchema } from '@/lib/contracts/matter';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { createMatterForUser, listMattersForUser, toUiMatter } from '@/lib/matters/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = requireUser(await getSessionUser(request));
    const matters = listMattersForUser(user).map(toUiMatter);
    return NextResponse.json({ matters, user: { id: user.id, fullName: user.fullName } });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = requireUser(await getSessionUser(request));
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
    }

    // Compat UI : party1/party2 ou parties[]
    const raw = body as Record<string, unknown>;
    let parties = raw.parties;
    if (!parties && (raw.party1 || raw.party2)) {
      parties = [
        raw.party1 ? { name: String(raw.party1), quality: 'Partie 1' } : null,
        raw.party2 ? { name: String(raw.party2), quality: 'Partie 2' } : null,
      ].filter(Boolean);
    }
    if (typeof raw.tags === 'string') {
      raw.tags = String(raw.tags)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const parsed = CreateMatterSchema.safeParse({
      ...raw,
      parties,
      riskLevel: raw.riskLevel ?? raw.risk_level ?? 'medium',
    });
    if (!parsed.success) {
      return NextResponse.json(
        { erreur: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const matter = createMatterForUser(user, parsed.data);
    return NextResponse.json({ matter: toUiMatter(matter) }, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ erreur: (e as Error).message }, { status });
  }
}
