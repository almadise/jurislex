# Cycle C2 — Confiance juridique

Livrables : **C2a** règles verified, **C2b** lecteur PDF pdf.js, **C2c** file éditoriale.

## C2a — Calculs juridiques ancrés

### Principe

| Statut | Signification |
|--------|----------------|
| `verified` / `computed` | Formule ou condition tirée d’un article du corpus indexé |
| `hypothesis_only` | Barème ou durée non fixée par le texte seul (ex. arrêté manquant) |
| `blocked_missing_input` | Données manquantes |

### Règles livrées

| ID | Domaine | Statut | Ancrage |
|----|---------|--------|---------|
| `prescription-salaire-indemnites-3ans` | Travail CM | **verified** | Art. 74 Loi 92-007 |
| `indemnite-licenciement-conditions` | Travail CM | **verified** | Art. 37 |
| `indemnite-licenciement-hypothese` | Travail CM | hypothesis | Art. 37 + barème 20/25 % |
| `preavis-obligation` | Travail CM | **verified** | Art. 34 |
| `preavis-duree-hypothese` | Travail CM | hypothesis | Art. 34 → arrêté |
| `indemnite-preavis-non-respecte` | Travail CM | **verified** | Art. 36 |
| `ohada-opposition-injonction-10j` | OHADA | **verified** | AUPSRVE Art. 9–10 |
| `ohada-commandement-saisie-vente-8j` | OHADA | **verified** | AUPSRVE Art. 91–92 |

Fichiers :

- `src/lib/analysis/ruleRegistry.ts` — registre
- `src/lib/analysis/rules.ts` — moteur
- `GET /api/rules` — liste

```bash
npm run test:rules
```

**Correction importante** : la prescription indicative n’est plus « 2 ans hypothèse » mais **3 ans Art. 74** (salaire + indemnités de rupture).

## C2b — Lecteur PDF pro

- Composant `PdfArticleViewer` (pdf.js, worker unpkg)
- `SourceReader` : dynamic import SSR-off, multi-pages, zoom, surlignage extrait/article
- Props : `page`, `pageEnd`, `excerpt`, `article`

Dépendance : `pdfjs-dist`.

## C2c — File éditoriale

### Workflow

```text
scan observatoire → sync file → pending → in_review → approved | rejected | quarantined
```

- Store local : `build/editorial-queue.json`
- SQL prod : `supabase/migrations/005_c2_editorial_queue.sql`
- API : `GET/POST /api/editorial`
  - `op: sync_observatory` — importe modified/new/missing
  - `op: action` — assign, approve, reject, quarantine, request_info, note
- UI : onglet **File éditoriale** sur `/observatory`
- Approve d’une source lève la quarantaine ; quarantine la pose

Checklist revue : provenance, statut juridique, relations CDC, qualité/OCR.

## Migrations Supabase

Ordre complet :

1. `schema.sql`
2. `001` … `004` (C1)
3. **`005_c2_editorial_queue.sql`**

## Smoke / tests

```bash
npm run test:rules
npm run smoke:auth
# avec serveur :
# inscription → sync editorial (session)
```

## Suite C3

Multi-tenant ACL, rétention, chiffrement champs, règles verified supplémentaires (foncier, marchés).
