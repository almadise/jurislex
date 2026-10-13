# Ingestion du corpus JurisLex

Document de référence produit. Détails opérationnels : [scripts/README.md](../scripts/README.md).

## Principes

1. **Idempotence** : SHA-256, upsert sur `slug` et `(document_id, chunk_index)`
2. **Non-destruction** : les PDF originaux sous `legal-content/` ne sont jamais écrasés ; OCR → `legal-content/_ocr/`
3. **Un chunk = un article** lorsque la structure le permet
4. **Statut prudent** : `legal_status = unknown` par défaut ; provenance `secondary` si le chemin contient `source_secondaire`
5. **Échantillon d’abord** : le Cycle A cible travail, OHADA/recouvrement, foncier ou marchés publics

## Domaines prioritaires Cycle A

| Domaine | Emplacement corpus |
|---------|-------------------|
| Droit du travail | `legal-content/18_Securite_sociale/` (Code du travail 92-007) |
| OHADA / recouvrement | `legal-content/02_Droit_OHADA/`, `legal-content/ohada/*.md` |
| Foncier | `legal-content/04_Foncier_domanial_urbanisme/` |
| Marchés publics (alt.) | `legal-content/08_Marches_publics/` |

## Pipeline

```text
00_verifier_corpus.py  →  intégrité, doublons, quarantaine
01_ocr.py              →  scans → _ocr/ (reprise --budget)
02_extract.py          →  build/chunks.jsonl + rapports
03_upload.py           →  embeddings + Supabase
```

## Index local (S1)

L’application peut servir la recherche **exacte** et **lexicale** directement depuis `build/chunks.jsonl` sans Supabase.  
Chemin configurable : `JURISLEX_CHUNKS_PATH`.

## Contrôles

```sql
select * from v_ingestion_status;
```

API :

```http
GET /api/recherche-legale
```

## Anomalies connues

- Dates CEMAC `NN-AA` parfois mal déduites en `date_texte` (numéro correct)
- `11_Numerique_communications/` vide (loi 2024-017 à récupérer)
- Fichiers en `_ecartes/` volontairement exclus
