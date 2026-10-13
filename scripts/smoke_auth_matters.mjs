/**
 * Smoke-test S3 : inscription, dossiers, isolation inter-utilisateurs.
 * Usage: node scripts/smoke_auth_matters.mjs
 * Prérequis: serveur dev sur :4028
 */
const BASE = process.env.JURISLEX_URL || 'http://localhost:4028';

function cookieJar() {
  let cookie = '';
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      // Node < 18 fallback
      const sc = raw.length
        ? raw
        : res.headers.get('set-cookie')
          ? [res.headers.get('set-cookie')]
          : [];
      for (const c of sc) {
        if (!c) continue;
        const part = c.split(';')[0];
        if (part.startsWith('jurislex_session=')) cookie = part;
      }
    },
    header() {
      return cookie ? { Cookie: cookie } : {};
    },
    clear() {
      cookie = '';
    },
  };
}

async function jsonFetch(path, { method = 'GET', body, jar } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jar?.header() || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (jar) jar.store(res);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function main() {
  const ts = Date.now();
  const jarA = cookieJar();
  const jarB = cookieJar();

  const emailA = `user.a.${ts}@jurislex.test`;
  const emailB = `user.b.${ts}@jurislex.test`;
  const password = 'TestS3-Isol@tion!';

  // Signup A
  let r = await jsonFetch('/api/auth/signup', {
    method: 'POST',
    jar: jarA,
    body: {
      email: emailA,
      password,
      fullName: 'Utilisateur A',
    },
  });
  if (!r.res.ok) throw new Error(`signup A: ${JSON.stringify(r.data)}`);
  console.log('A signed up', r.data.user.id, 'role=', r.data.user.role);
  // C1 : tentative d’élévation admin via body — doit rester non-admin après bootstrap
  if (r.data.user.role === 'admin') {
    console.log('A is bootstrap admin (premier compte) — OK');
  }

  // Signup B
  r = await jsonFetch('/api/auth/signup', {
    method: 'POST',
    jar: jarB,
    body: {
      email: emailB,
      password,
      fullName: 'Utilisateur B',
      role: 'admin', // doit être ignoré
    },
  });
  if (!r.res.ok) throw new Error(`signup B: ${JSON.stringify(r.data)}`);
  if (r.data.user.role === 'admin' || r.data.user.role === 'reviewer') {
    throw new Error(`C1 FAIL: élévation rôle non bloquée pour B (role=${r.data.user.role})`);
  }
  console.log('B signed up', r.data.user.id, 'role=', r.data.user.role, '(élévation bloquée OK)');

  // Create matter as A
  r = await jsonFetch('/api/matters', {
    method: 'POST',
    jar: jarA,
    body: {
      title: 'Dossier secret A — licenciement',
      domain: 'Droit du travail',
      parties: [{ name: 'Salarié A' }, { name: 'Employeur A' }],
      riskLevel: 'high',
      tags: ['isolation-test'],
    },
  });
  if (!r.res.ok) throw new Error(`create matter A: ${JSON.stringify(r.data)}`);
  const matterId = r.data.matter.id;
  const reference = r.data.matter.reference;
  console.log('A created matter', reference, matterId);

  // A can read
  r = await jsonFetch(`/api/matters/${matterId}`, { jar: jarA });
  if (!r.res.ok || r.data.matter?.id !== matterId) {
    throw new Error('A should read own matter');
  }
  console.log('A read OK');

  // B list empty of A's matter
  r = await jsonFetch('/api/matters', { jar: jarB });
  if (!r.res.ok) throw new Error('B list failed');
  const leak = (r.data.matters || []).find((m) => m.id === matterId);
  if (leak) throw new Error('FAIL: B sees A matter in list');
  console.log('B list isolation OK (no leak)');

  // B direct GET must 404
  r = await jsonFetch(`/api/matters/${matterId}`, { jar: jarB });
  if (r.res.status !== 404) {
    throw new Error(`FAIL: B direct access status=${r.res.status} body=${JSON.stringify(r.data)}`);
  }
  console.log('B direct access denied (404)');

  // B export denied
  r = await jsonFetch(`/api/matters/${matterId}?export=1`, {
    method: 'PUT',
    jar: jarB,
  });
  if (r.res.status !== 404) {
    throw new Error(`FAIL: B export status=${r.res.status}`);
  }
  console.log('B export denied');

  // Unauthenticated denied
  r = await jsonFetch('/api/matters');
  if (r.res.status !== 401) {
    throw new Error(`FAIL: anon list status=${r.res.status}`);
  }
  console.log('Anon denied');

  // A export ok
  r = await jsonFetch(`/api/matters/${matterId}?export=1`, {
    method: 'PUT',
    jar: jarA,
  });
  if (!r.res.ok || !r.data.export) throw new Error('A export failed');
  console.log('A export OK');

  // A hard delete
  r = await jsonFetch(`/api/matters/${matterId}?hard=1`, {
    method: 'DELETE',
    jar: jarA,
  });
  if (!r.res.ok) throw new Error('A delete failed');
  console.log('A delete OK');

  console.log('OK smoke auth+matters isolation');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
