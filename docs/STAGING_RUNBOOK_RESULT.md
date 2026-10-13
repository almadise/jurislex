# Résultat runbook staging — projet Supabase `jurisLex`

**Projet :** `mwvogydwkxjngngqlqgx` (Central Europe / Zurich)  
**Date :** 2026-07-20  
**Script :** `python scripts/staging_runbook_c1.py`

## Contexte schéma

Le staging n’utilisait **pas** le schéma local `profiles` / `matters` des migrations 002–004 brutes, mais un schéma déjà déployé :

| Staging (existant) | Attendu par code local C1 |
|--------------------|---------------------------|
| `user_profiles` | `profiles` |
| `legal_provisions`, `legal_text_versions` | `legal_relations`, `legal_document_versions` |
| `review_items`, `correction_queue` | file éditoriale C2 |
| `ingestion_jobs` (forme différente) | `ingestion_jobs` C1 |

→ Migration adaptée appliquée :  
`supabase/migrations/004_c1_staging_jurislex_adapt.sql`

## Checklist

| # | Action | Statut |
|---|--------|--------|
| 1 | Migration CDC / auth anti-élévation (adapt staging) | **OK** — tables `profiles`, `legal_relations`, `legal_document_versions` en HTTP 200 |
| 2 | `JURISLEX_AUTH_BACKEND=supabase` + session secret | **OK** — `.env.local` |
| 3 | `promote_user_role` reviewer | **OK** — `fotso.mbarga@juriscm.cm` → `profiles.role=reviewer`, `user_profiles.role=lawyer` (mapping app) |
| 4 | Seed relations pilote | **OK** — ≥4 relations `probable` (travail ↔ constitution / OHADA) |
| 5 | Pack validation juriste 2–3 formules | **OK** — livrable humain (pas de signature juriste réelle) |

## Reviewer promu

- **Email :** fotso.mbarga@juriscm.cm  
- **UUID :** `24d275eb-233a-4e34-8f0b-83805b96f9b6`  
- **profiles.role :** `reviewer`  
- **user_profiles.role :** `lawyer` (équivalent métier staging ; l’app mappe `lawyer` → `reviewer`)

RPC : `select public.promote_user_role('<uuid>', 'reviewer');`

## Relations seed (échantillon)

- `refers_to` probable — Loi 1992-007 Code du travail → Constitution / révision 2008  
- `refers_to` / `cites` probable — pilotes REST travail ↔ OHADA  

Confidence volontairement **`probable`** jusqu’à revue juriste → `verified`.

## Validation juriste (étape 5)

Les formules code sont **candidates** ; la validation humaine n’est pas automatisable.

Fichiers à transmettre au juriste :

1. [`docs/VALIDATION_JURISTE_C2A.md`](VALIDATION_JURISTE_C2A.md) — checklist imprimable  
2. `build/jurist_validation_pack_c2a.json` — version machine  

### Formules à valider (2–3)

1. **prescription-salaire-indemnites-3ans** — Art. 74 Loi 92-007  
2. **indemnite-licenciement-conditions** — Art. 37 (montant reste hypothesis)  
3. **ohada-opposition-injonction-10j** — AUPSRVE Art. 9–10  

Après signature : mettre à jour `docs/VALIDATION_JURISTE_C2A.md` (décisions) et éventuellement lever `confidence` des relations seed.

## Auth app

- `fetchSupabaseProfile` lit `profiles` puis bascule `user_profiles`.  
- Rôles : `lawyer` / `juriste` → `reviewer`.

## Commandes de rejeu

```bash
npx supabase link --project-ref mwvogydwkxjngngqlqgx --yes
python scripts/staging_runbook_c1.py --all
# ou par étape :
python scripts/staging_runbook_c1.py --apply-sql
python scripts/staging_runbook_c1.py --promote
python scripts/staging_runbook_c1.py --seed
python scripts/staging_runbook_c1.py --jurist-pack
```

## Runbook C1 restant (manuel UI)

- [ ] Auth Email activé dans Supabase Studio  
- [ ] Inscription test + isolation dossiers (si table `matters` / `cases` branchée)  
- [ ] Smoke `npm run smoke:auth` avec backend supabase  
- [ ] Confirmer e-mail si option « Confirm email » ON  
