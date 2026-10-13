import { NextResponse } from 'next/server';
import { RULE_REGISTRY, listVerifiedRules } from '@/lib/analysis/ruleRegistry';

export const runtime = 'nodejs';

/** GET /api/rules — registre des règles déterministes (C2a) */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const onlyVerified = url.searchParams.get('verified') === '1';
  const rules = onlyVerified ? listVerifiedRules() : RULE_REGISTRY;
  return NextResponse.json({
    rules,
    count: rules.length,
    verifiedCount: listVerifiedRules().length,
  });
}
