# JurisLex

MVP d’assistance juridique traçable (Cameroun / OHADA / CEMAC / COBAC / CIMA / OAPI).  
Recherche exacte, lexicale et hybride sur un corpus PDF indexé — pas un chatbot généraliste.

## État Sprint S0 + S1

| Capacité | Statut |
|----------|--------|
| Pipeline ingestion (OCR → extract → embeddings) | Opérationnel (`scripts/`) |
| Index local `build/chunks.jsonl` | Recherche exacte + lexicale sans Supabase |
| API `POST /api/recherche-legale` | Modes `exact` \| `lexical` \| `semantic`/`hybrid` |
| UI Recherche | Branchée sur l’API (plus de mocks juridiques) |
| Q&A sourcée | `POST /api/qa` + UI branchée (citations post-vérifiées) |
| Auth + dossiers isolés | Session cookie + store local (S3) ; SQL RLS Supabase fourni |
| Analyse de situation | Extraction faits + clarifications + calculs déterministes + corpus (S4) |
| Génération documentaire | 5 modèles versionnés + validation + export DOCX/PDF réels (S5) |
| Évaluation formalisée | `npm run eval` — suite `evals/cases/v1` |
| Lecteur PDF page/article | `SourceReader` + `/api/sources/file` |
| Graphe dossier | `/matter-graph` |
| Observatoire | `/observatory` (SHA-256 + quarantaine) |
| Auth Supabase prod | `JURISLEX_AUTH_BACKEND=supabase` + migrations 002–004 (rôle non élevé à l’inscription) |
| Worker ingestion C1 | Redis + `scripts/worker.py` + `POST /api/ingestion/jobs` |
| Schéma CDC relations | `legal_relations`, versions document/article (`004`) |
| Règles verified C2a | Art. 74/37/34/36 + OHADA AUPSRVE 10/92 — `GET /api/rules` |
| Lecteur PDF C2b | pdf.js + highlight article (`SourceReader`) |
| File éditoriale C2c | `/observatory` + `005` + `POST /api/editorial` |

## Prérequis

- Node.js 20+
- Python 3.10+ (ingestion)
- Corpus sous `legal-content/` (non versionné si volumineux)
- Optionnel : projet Supabase (pgvector) + clé OpenAI (sémantique hybride)

## Démarrage rapide (recherche vérifiable)

```bash
# 1. Dépendances front
npm install

# 2. Variables d'environnement
copy .env.example .env.local
# Renseigner au minimum rien pour le mode index local
# (OPENAI_API_KEY et Supabase restent optionnels pour exact/lexical)

# 3. Index local (si build/chunks.jsonl absent)
pip install -r scripts/requirements.txt
python scripts/02_extract.py

# 4. Application
npm run dev
# → http://localhost:4028
```

### Requêtes de smoke-test

1. Mode **Référence exacte** : `article 40 loi 92-007` ou `loi 1992-007 art. 40`
2. Mode **Lexical** : `injonction de payer` ou `titre foncier`
3. Mode **Sémantique** : reformulation en langage courant (hybride si OpenAI + Supabase)

API :

```bash
curl -s -X POST http://localhost:4028/api/recherche-legale ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"article 40 loi 92-007\",\"mode\":\"exact\",\"limit\":5}"
```

```bash
curl -s http://localhost:4028/api/recherche-legale
```

## Structure

```
src/app/                  # UI Next.js (App Router)
src/app/api/recherche-legale/  # API recherche
src/lib/contracts/        # Schémas Zod (contrats stables Cycle B)
src/lib/search/           # Moteur exact / lexical / hybride + index local
scripts/                  # Pipeline Python d'ingestion
supabase/                 # Schéma + migrations SQL
legal-content/            # Corpus PDF (sources)
build/chunks.jsonl        # Index extrait (généré)
docs/                     # Installation, ingestion
```

## Ingestion Supabase (optionnel)

Voir [docs/INGESTION.md](docs/INGESTION.md) et [scripts/README.md](scripts/README.md).

1. Exécuter `supabase/schema.sql` puis `supabase/migrations/001_s0_search_foundations.sql`
2. `python scripts/01_ocr.py` (si scans)
3. `python scripts/02_extract.py`
4. `python scripts/03_upload.py`

## Documentation

- [Installation](docs/INSTALLATION.md)
- [Ingestion du corpus](docs/INGESTION.md)
- [Cycle B — eval, PDF, RLS, graphe, observatoire](docs/CYCLE_B.md)
- [Cycle C1 — prod-safe (auth, worker, relations CDC)](docs/CYCLE_C1.md)
- [Cycle C2 — règles verified, PDF, file éditoriale](docs/CYCLE_C2.md)
- [Sécurité](docs/SECURITE.md)
- [Pipeline scripts](scripts/README.md)

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur dev port 4028 |
| `npm run build` | Build production |
| `npm run type-check` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm run smoke:search` | Smoke-test API recherche |
| `npm run smoke:qa` | Smoke-test Q&A sourcée |
| `npm run smoke:auth` | Smoke-test auth + isolation dossiers |
| `npm run smoke:analysis` | Smoke-test analyse de faits |
| `npm run smoke:documents` | Smoke-test génération DOCX/PDF |
| `npm run eval` | Jeu d’évaluation versionné (CDC §12) |
| `npm run test:rules` | Tests calculs déterministes |
| `npm run smoke:ingestion` | Smoke file d’ingestion + worker quality |
| `npm run worker` | Worker local (poll fichier jobs) |
| `npm run quality` | Scores qualité `build/rapport_qualite.json` |
| `docker compose up --build` | web + worker + Redis (C1) |

## Principes (CDC)

- Toute affirmation juridique doit être reliée à une disposition récupérée.
- Ne jamais présenter un texte secondaire comme officiel sans l’indiquer.
- Ne pas marquer un texte « en vigueur » sans preuve (`legal_status = unknown` par défaut).
- Secrets uniquement dans `.env.local` (voir `.env.example`).
