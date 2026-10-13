/**
 * Parse d'une référence juridique exacte (loi, décret, article).
 * Déterministe — pas d'embedding.
 */

export interface ParsedExactQuery {
  raw: string;
  articleNum: string | null;
  /** Numéros de texte candidats (normalisés). */
  textNumbers: string[];
  /** Tokens significatifs hors « article ». */
  keywords: string[];
  typeHint: string | null;
}

const TYPE_HINTS: { re: RegExp; type: string }[] = [
  { re: /\bactes?\s+uniformes?\b|\baudcg\b|\baupsrve\b|\bauscgie\b|\bahada\b|\bohada\b/i, type: 'OHADA' },
  { re: /\bloi\b/i, type: 'Loi' },
  { re: /\bd[eé]cret\b/i, type: 'Décret' },
  { re: /\bordonnances?\b/i, type: 'Ordonnance' },
  { re: /\br[eè]glements?\b/i, type: 'Règlement' },
  { re: /\barr[eê]t[eé]s?\b/i, type: 'Arrêté' },
  { re: /\bcodes?\b/i, type: 'Code' },
];

/** Normalise un numéro : 92/007, 92-007, n° 92-007 → variantes. */
export function expandNumeroVariants(n: string): string[] {
  const cleaned = n
    .replace(/n[°ºo]\s*/gi, '')
    .replace(/\s+/g, '')
    .replace(/[./]/g, '-');
  const variants = new Set<string>([cleaned, n.trim()]);
  // 92-007 ↔ 1992-007
  const m = /^(\d{2})-(\d+)$/.exec(cleaned);
  if (m) {
    variants.add(`19${m[1]}-${m[2]}`);
    variants.add(`20${m[1]}-${m[2]}`);
  }
  const m4 = /^(19|20)(\d{2})-(\d+)$/.exec(cleaned);
  if (m4) {
    variants.add(`${m4[2]}-${m4[3]}`);
  }
  // without dashes
  variants.add(cleaned.replace(/-/g, ''));
  return [...variants].filter(Boolean);
}

export function parseExactQuery(query: string): ParsedExactQuery {
  const raw = query.trim();
  let articleNum: string | null = null;

  // Article premier / Art. 40 / Art 12 bis / article 853-1
  const artRe =
    /\b(?:art(?:icle)?\.?\s*)(premier|1er|1\s*er|[\d]+(?:\s*bis|\s*ter|\s*quater)?(?:-[\d]+)?)\b/i;
  const artMatch = artRe.exec(raw);
  if (artMatch) {
    let a = artMatch[1].toLowerCase().replace(/\s+/g, ' ').trim();
    if (a === 'premier' || a === '1er' || a === '1 er') a = '1';
    articleNum = a.replace(/\s+/g, '');
  }

  const textNumbers: string[] = [];
  // n° 92-007, 2018/366, R-2010-01, 74-1
  const numRes = [
    /\bn[°ºo]?\s*([0-9]{2,4}\s*[/\-.]\s*[0-9]{1,4}(?:\s*[/\-.]\s*[0-9]+)?)/gi,
    /\b((?:19|20)\d{2}\s*[/\-.]\s*\d{1,4})\b/g,
    /\b(R[-\s]?\d{4}[-\s]?\d{1,3})\b/gi,
    /\b(\d{2}\s*[/\-.]\s*\d{1,4})\b/g,
  ];
  for (const re of numRes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      textNumbers.push(...expandNumeroVariants(m[1]));
    }
  }

  let typeHint: string | null = null;
  for (const h of TYPE_HINTS) {
    if (h.re.test(raw)) {
      typeHint = h.type;
      break;
    }
  }

  const stop = new Set([
    'art',
    'article',
    'articles',
    'loi',
    'decret',
    'décret',
    'ordonnance',
    'reglement',
    'règlement',
    'code',
    'du',
    'de',
    'des',
    'la',
    'le',
    'les',
    'et',
    'ou',
    'au',
    'aux',
    'en',
    'sur',
    'par',
    'n',
    'no',
    'numero',
    'numéro',
  ]);
  const keywords = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !stop.has(t) && !/^\d+$/.test(t));

  return {
    raw,
    articleNum,
    textNumbers: [...new Set(textNumbers)],
    keywords: [...new Set(keywords)],
    typeHint,
  };
}

/** Compare numéros d'article de façon souple (12, 12 bis, 12bis). */
export function articleMatches(stored: string | null | undefined, wanted: string): boolean {
  if (!stored) return false;
  const a = stored.toLowerCase().replace(/\s+/g, '').replace(/^art(?:icle)?/, '');
  const b = wanted.toLowerCase().replace(/\s+/g, '').replace(/^art(?:icle)?/, '');
  if (a === b) return true;
  if (a.replace(/bis|ter|quater/g, '') === b.replace(/bis|ter|quater/g, '') && a.includes(b.slice(0, 2))) {
    return a.startsWith(b) || b.startsWith(a);
  }
  // premier
  if ((a === '1' || a === 'premier') && (b === '1' || b === 'premier')) return true;
  return false;
}
