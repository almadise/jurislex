# Installation JurisLex (locale)

## 1. Cloner et installer

```bash
cd jurislex
npm install
pip install -r scripts/requirements.txt
```

## 2. Configuration

```bash
copy .env.example .env.local
```

| Variable | Obligatoire ? | Rôle |
|----------|---------------|------|
| `JURISLEX_CHUNKS_PATH` | Non (défaut `build/chunks.jsonl`) | Index local |
| `NEXT_PUBLIC_SUPABASE_URL` | Non pour exact/lexical local | API Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Non pour exact/lexical local | Lecture corpus |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui pour upload | Ingestion uniquement |
| `OPENAI_API_KEY` | Non pour exact/lexical | Embeddings hybride |
| `NEXT_PUBLIC_DEMO_MODE` | Non | `false` par défaut — pas de mocks juridiques |

## 3. Corpus et index

Le dépôt attend les PDF sous `legal-content/`.  
Produire l’index :

```bash
python scripts/00_verifier_corpus.py
python scripts/02_extract.py
```

Sans OCR, seuls les PDF avec couche texte native sont extraits.  
Pour les scans : installer Tesseract (fra) + Ghostscript, puis `python scripts/01_ocr.py`.

## 4. Lancer l’app

```bash
npm run dev
```

Ouvrir http://localhost:4028 — page d’accueil = recherche juridique branchée API.  
Q&A sourcée : menu **Questions & Réponses** ou `/legal-q-a`.

Smoke-tests (serveur dev requis) :

```bash
npm run smoke:search
npm run smoke:qa
npm run smoke:auth
npm run smoke:analysis
npm run smoke:documents
npm run eval
npm run test:rules
```

Voir aussi :
- [docs/CYCLE_B.md](CYCLE_B.md) (évaluation, lecteur PDF, Supabase RLS, graphe, observatoire)
- [docs/CYCLE_C1.md](CYCLE_C1.md) (auth durcie, worker Docker/Redis, relations CDC, qualité)
- [docs/CYCLE_C2.md](CYCLE_C2.md) (règles verified, lecteur PDF, file éditoriale)

### Génération documentaire (S5)

- UI : `/document-generation` — 4 étapes : modèle → saisie → confirmation → aperçu/export
- `GET /api/documents/templates` — 5 modèles versionnés
- `POST /api/documents/generate` — validation champs, rendu, refus si `{{var}}` restant
- `POST /api/documents/export` — `format: docx|pdf` (binaire)
- Requête/saisine (`tpl-requete-saisine`) : export bloqué sans `confirmProfessionalReview: true` (+ filigrane PROJET)
- Libs : `docx`, `pdfkit`


### Analyse de situation (S4)

- UI : `/legal-analysis` ou `/legal-analysis?matterId=<uuid>` (préremplissage dossier)
- Depuis un dossier : bouton **Analyser** → deep-link avec `matterId`
- `POST /api/analysis/extract-facts` → faits structurés + questions (qualif / délai / preuve / document)
- `POST /api/analysis/analyze` → qualification, droit corpus, risques, calculs déterministes
- Calculs (indemnité hypothétique, prescription, préavis) : `src/lib/analysis/rules.ts` — jamais par LLM libre
- Si connecté : analyse **enregistrée** ; si `matterId` : compteur dossier + statut `analysis` + historique onglet Analyses
- `GET /api/analysis?matterId=` → historique isolé propriétaire


### Auth & dossiers (S3)

- Inscription / connexion : `/sign-up-login` → `POST /api/auth/signup|login`
- Sessions : cookie httpOnly `jurislex_session` (HMAC, `JURISLEX_SESSION_SECRET`)
- Dossiers : `GET/POST /api/matters`, `GET/PATCH/DELETE /api/matters/:id`
- Store local par défaut : `build/local-db.json` (users, matters, audit)
- Isolation : un utilisateur ne peut ni lister ni lire le dossier d’un autre (404 + audit `access_denied`)
- Production Supabase : migrations `002` → `004` (RLS + graphe CDC + jobs)
- **Rôle** : non choisi à l’inscription (toujours `standard` sauf bootstrap local 1er compte)

## 5. Supabase (optionnel mais recommandé pour sémantique)

1. Créer un projet Supabase, activer l’extension `vector`
2. SQL Editor : coller `supabase/schema.sql`
3. Puis migrations `001` → `004` dans l’ordre
4. Renseigner les clés dans `.env.local` (`JURISLEX_AUTH_BACKEND=supabase` en prod)
5. `python scripts/03_upload.py --estimation` puis `python scripts/03_upload.py`
6. Optionnel : seed relations pilote `supabase/snippets/seed_c1_pilot_relations.sql`

## 6. Docker C1 (web + worker + Redis)

```bash
copy .env.example .env.local
# renseigner au minimum JURISLEX_SESSION_SECRET
docker compose up --build
# → http://localhost:4028
# Worker consomme REDIS_URL ; jobs via POST /api/ingestion/jobs
```

## Dépannage

| Symptôme | Piste |
|----------|--------|
| `Aucun corpus disponible` | `build/chunks.jsonl` manquant → `02_extract.py` |
| Recherche sémantique « dégradée » | `OPENAI_API_KEY` absente ou Supabase non configuré |
| Erreur dimension embedding | Modèle attendu `text-embedding-3-small` (1536) |
| `supabase-js` manquant | `npm install @supabase/supabase-js` |
