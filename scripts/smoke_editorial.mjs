/**
 * Smoke C2c — file éditoriale (signup → sync → approve).
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4028';

function cookieJar() {
  const jar = { cookie: null };
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      const parts = raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean);
      for (const c of parts) {
        const m = String(c).match(/jurislex_session=[^;]+/);
        if (m) jar.cookie = m[0];
      }
    },
    header() {
      return jar.cookie ? { Cookie: jar.cookie } : {};
    },
  };
}

async function jsonFetch(path, { method = 'GET', jar, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...jar?.header(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar?.store(res);
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function main() {
  const jar = cookieJar();
  const ts = Date.now();
  let r = await jsonFetch('/api/auth/signup', {
    method: 'POST',
    jar,
    body: {
      email: `ed.${ts}@jurislex.test`,
      password: 'TestC2-Editorial!1',
      fullName: 'Editorial Smoke',
    },
  });
  if (!r.res.ok) throw new Error(`signup ${JSON.stringify(r.data)}`);

  r = await jsonFetch('/api/editorial', {
    method: 'POST',
    jar,
    body: {
      itemType: 'rule',
      title: 'Revue règle prescription Art. 74',
      ruleId: 'prescription-salaire-indemnites-3ans',
      note: 'Smoke C2c',
      priority: 5,
    },
  });
  if (!r.res.ok) throw new Error(`create ${JSON.stringify(r.data)}`);
  const id = r.data.item.id;
  console.log('item', id, r.data.item.status);

  r = await jsonFetch('/api/editorial', {
    method: 'POST',
    jar,
    body: { op: 'action', itemId: id, action: 'start_review', note: 'prise en charge' },
  });
  if (!r.res.ok) throw new Error(`review ${JSON.stringify(r.data)}`);
  if (r.data.item.status !== 'in_review') throw new Error(`expected in_review got ${r.data.item.status}`);

  r = await jsonFetch('/api/editorial', {
    method: 'POST',
    jar,
    body: {
      op: 'action',
      itemId: id,
      action: 'approve',
      note: 'ancre Art. 74 OK',
      checklist: {
        provenanceChecked: true,
        legalStatusChecked: true,
        relationsChecked: true,
        qualityChecked: true,
      },
    },
  });
  if (!r.res.ok) throw new Error(`approve ${JSON.stringify(r.data)}`);
  if (r.data.item.status !== 'approved') throw new Error(`expected approved`);

  r = await jsonFetch('/api/rules?verified=1');
  if (!r.res.ok) throw new Error(`rules ${JSON.stringify(r.data)}`);
  console.log('verified rules', r.data.verifiedCount);

  console.log('smoke:editorial OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
