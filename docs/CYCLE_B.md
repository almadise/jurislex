# Cycle B — industrialisation & polish

## 1. Jeu d’évaluation formalisé

```bash
npm run dev          # terminal 1
npm run eval         # terminal 2
```

- Suite versionnée : `evals/cases/v1/suite.json`
- Runner : `evals/run.mjs`
- Rapport : `evals/results/latest.json`

Couverture CDC §12 (échantillon MVP) :

| Catégorie | Cas |
|-----------|-----|
| Recherche exacte / lexicale / sémantique | oui |
| Hors corpus | oui |
| Q&A citations vérifiées + abstention | oui |
| Faits incomplets + calcul indemnité | oui |
| Document champs manquants / sans `{{var}}` | oui |
| Saisine bloquée sans revue | oui |
| Isolation inter-utilisateurs | oui |
| Injection de prompt dans champs | oui |

## 2. Lecteur source PDF page/article

- API : `GET /api/sources/file?path=…` (path traversal bloqué)
- UI : composant `SourceReader` — iframe PDF + `#page=N` + extrait article
- Intégré dans l’aperçu recherche (onglet Source) et le panneau de citations Q&A

## 3. Auth Supabase RLS (prod)

1. Appliquer dans l’ordre :
   - `supabase/schema.sql`
   - `supabase/migrations/001_s0_search_foundations.sql`
   - `supabase/migrations/002_s3_matters_auth.sql`
   - `supabase/migrations/003_cycle_b_observatory_graph.sql`
   - `supabase/migrations/004_c1_legal_graph_ingestion.sql` (C1 — relations CDC + jobs + anti-élévation rôle)
   - `supabase/migrations/005_c2_editorial_queue.sql` (C2c — file éditoriale)
2. Activer Auth Email dans Supabase
3. `.env.local` :
   ```
   JURISLEX_AUTH_BACKEND=supabase
   NEXT_PUBLIC_SUPABASE_URL=…
   NEXT_PUBLIC_SUPABASE_ANON_KEY=…
   ```
4. Inscription/login passent par Supabase Auth ; RLS isole `matters`, analyses, documents

Mode `hybrid` : tente Supabase puis bascule store local.

## 4. Graphe du dossier

- UI : `/matter-graph?matterId=`
- API : `GET /api/matters/:id/graph`
- Nœuds : matter, parties, faits, preuves, questions, articles, documents
- Isolation propriétaire (404 si accès croisé)

## 5. Observatoire des mises à jour

- UI : `/observatory`
- API : `GET/POST /api/observatory`
- Scan SHA-256 disque vs `build/chunks.jsonl`
- Statuts : `unchanged` | `modified` | `new` | `missing` | `quarantined`
- Quarantaine persistée : `build/observatory-quarantine.json`
- Tables prod : `source_versions`, `source_quarantine` (migration 003)

Workflow type :

1. Rescan → repérer `modified` / `new`
2. Quarantainer les sources touchées
3. Ré-ingérer (OCR → extract → upload)
4. Libérer la quarantaine après validation
