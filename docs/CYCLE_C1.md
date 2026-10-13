# Cycle C1 — Prod-safe

Livrable : fondations production (auth durcie, schéma CDC relations/versions, worker Docker + Redis, file d’ingestion + scores qualité).

## 1. Auth / RLS — correctif élévation de rôle

### Problème corrigé

À l’inscription, `raw_user_meta_data.role` pouvait être pris en compte (SQL + metadata JWT). Un client pouvait s’auto-promouvoir `admin` / `reviewer`.

### Correctifs

| Couche | Changement |
|--------|------------|
| SQL `004` | `handle_new_user()` force toujours `role = 'standard'` |
| SQL `004` | `promote_user_role(user_id, role)` réservé admin / service_role |
| API signup | n’envoie plus `role` dans user_metadata Supabase |
| Local store | second compte+ toujours `standard` ; premier compte bootstrap `admin` |
| Session / login | rôle lu depuis `public.profiles`, pas metadata |
| UI signup | sélecteur de rôle retiré |

### Runbook production (&lt; 30 min)

1. Créer un projet Supabase (staging puis prod).
2. SQL Editor, **dans l’ordre** :
   - `supabase/schema.sql`
   - `supabase/migrations/001_s0_search_foundations.sql`
   - `supabase/migrations/002_s3_matters_auth.sql`
   - `supabase/migrations/003_cycle_b_observatory_graph.sql`
   - `supabase/migrations/004_c1_legal_graph_ingestion.sql`
   - **Si le projet a déjà un schéma legacy** (`user_profiles`, etc.) : utiliser plutôt  
     `004_c1_staging_jurislex_adapt.sql` (voir [STAGING_RUNBOOK_RESULT.md](STAGING_RUNBOOK_RESULT.md)).

Automatisation staging (projet `jurisLex` lié) :

```bash
npx supabase link --project-ref mwvogydwkxjngngqlqgx --yes
python scripts/staging_runbook_c1.py --all
```
3. Authentication → Providers → **Email** activé.
4. (Recommandé) désactiver « Confirm email » en staging pour les smoke-tests.
5. `.env.local` :

```env
JURISLEX_AUTH_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_URL=https://XXXX.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # worker / scripts uniquement
JURISLEX_SESSION_SECRET=<random-32+>
REDIS_URL=redis://localhost:6379/0
```

6. Vérifications :
   - Inscription user A puis B avec `role: "admin"` dans le body → B reste `standard`.
   - User A ne lit pas le matter de B (`npm run smoke:auth`).
   - Bundle client : aucune `service_role` (`grep` / Network).
7. Promouvoir un reviewer (SQL) :

```sql
select public.promote_user_role('<uuid-user>', 'reviewer');
-- ou en tant qu'admin authentifié via RPC
```

### Checklist

- [ ] Migrations 001–004 appliquées
- [ ] Auth email ON
- [ ] Trigger profil sans élévation role
- [ ] 2 comptes : isolation matters
- [ ] `JURISLEX_AUTH_BACKEND=supabase` (pas de fallback local en prod)
- [ ] service_role absente du client

## 2. Schéma juridique CDC (relations + versions)

Migration : `supabase/migrations/004_c1_legal_graph_ingestion.sql`

| Table | Rôle |
|-------|------|
| `legal_document_versions` | Versions JO / rectificatifs d’une famille d’actes |
| `legal_relations` | LegalRelation (abrogates, amends, refers_to, …) + confidence |
| `legal_article_versions` | Texte d’article daté (as_of) |
| `ingestion_jobs` | File de jobs worker |
| `ingestion_quality_reports` | Scores qualité |

RPC :

- `get_article_as_of(numero, article, as_of)`
- `get_legal_relations(document_id)`

Contrats Zod : `src/lib/contracts/legal.ts`, `src/lib/contracts/ingestion.ts`.

Seed pilote (après upload corpus) :

```bash
# SQL Editor : supabase/snippets/seed_c1_pilot_relations.sql
```

## 3. Docker : web + worker + Redis

```bash
# Services prod-like
docker compose up --build

# Dev hot-reload web + redis + worker
docker compose --profile dev up --build web-dev worker redis
```

| Service | Image | Port |
|---------|-------|------|
| `web` | `Dockerfile` (Next build) | 4028 |
| `worker` | `Dockerfile.worker` (Python + tesseract) | — |
| `redis` | redis:7-alpine | 6379 |
| `web-dev` | `Dockerfile.dev` (profile `dev`) | 4028 |

Volumes partagés : `./build`, `./legal-content`.

## 4. File d’ingestion + qualité

### API

```http
POST /api/ingestion/jobs
Authorization: cookie session
{
  "jobType": "pipeline",
  "payload": {
    "steps": ["verify", "extract", "quality"],
    "qualityThreshold": 55,
    "dryRun": true
  }
}

GET /api/ingestion/jobs
GET /api/ingestion/jobs/:id
```

Rôles : en `production` / backend supabase → `admin` | `reviewer` uniquement pour POST.

### Worker

```bash
# Local sans Docker
pip install -r scripts/requirements.txt
python scripts/worker.py --poll-file          # boucle fichier
python scripts/worker.py --once               # un job
python scripts/worker.py --job-id <uuid>

# Avec Redis
set REDIS_URL=redis://localhost:6379/0
python scripts/worker.py
```

### Qualité

```bash
python scripts/quality_score.py
# → build/rapport_qualite.json (score 0–100, flags, quarantined)
```

Heuristiques : % articles détectés, chunks courts, bruit OCR, rapport d’intégrité.

### Smoke

```bash
npm run dev          # terminal 1
npm run smoke:auth
npm run smoke:ingestion
```

## 5. Hors scope C1 (C2+)

- Lecteur pdf.js + highlight
- File éditoriale complète observatoire
- Multi-tenant ACL / rétention / chiffrement champs
- Règles juridiques `verified` en masse
