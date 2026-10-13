import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString('hex');
  const hash = scryptSync(password, s, 64, SCRYPT_PARAMS).toString('hex');
  return `${s}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64, SCRYPT_PARAMS).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
  } catch {
    return false;
  }
}

export function getSessionSecret(): string {
  const env = process.env.JURISLEX_SESSION_SECRET;
  if (env && env.length >= 16) return env;
  // Déterministe pour le dev local si secret non fourni (pas pour prod)
  return 'jurislex-dev-session-secret-change-me';
}

export function signSession(payload: object, ttlSeconds = 60 * 60 * 24 * 7): string {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySession<T extends { exp?: number }>(token: string): T | null {
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Hash d'IP pour audit (pas de stockage brut). */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHmac('sha256', getSessionSecret()).update(ip).digest('hex').slice(0, 16);
}

/** Masque email dans les logs. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const u = user.length <= 2 ? '*'.repeat(user.length) : `${user[0]}***${user[user.length - 1]}`;
  return `${u}@${domain}`;
}
