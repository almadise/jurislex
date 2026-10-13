# Ingestion de la base légale JurisLex

Pipeline d'ingestion du corpus `legal-content/` (Cameroun, OHADA, CEMAC, COBAC, CIMA, OAPI)
vers Supabase + pgvector, pour l'appel de la base légale depuis l'application.

## État du corpus au 19/07/2026

| | |
|---|---|
| PDF sur disque | 106 (372 Mo) |
| Écartés (quarantaine) | 3 |
| **Corpus retenu** | **103** |
| Avec couche texte | 53 |
| **Scannés, OCR requis** | **50** |
| Doublons binaires restants | 0 |
| Chunks extraits (53 lisibles) | 4 485 |
| Coût embeddings estimé | ~0,02 USD |

### Écartés le 19/07/2026

`Loi_2024-017_protection_donnees_personnelles.pdf` et son doublon binaire
`Journal_officiel_2024_loi_2024-017_donnees_personnelles.pdf` ont été déplacés dans
`legal-content/_ecartes/`. Ces PDF ne contiennent pas la loi annoncée mais le bulletin
« N° 80 – Novembre/Décembre 2024 » du Cabinet Civil de la Présidence. Détail et
marche à suivre : `legal-content/_ecartes/POURQUOI.md`.

Les scripts `00`, `01` et `02` ignorent `_ecartes/` et `_ocr/`.

## Worker C1 (file async)

```bash
# Qualité seule
python scripts/quality_score.py

# Worker (fichier local build/ingestion-jobs.json)
python scripts/worker.py --poll-file

# Worker Redis (docker compose up redis)
set REDIS_URL=redis://localhost:6379/0
python scripts/worker.py
```

API Next : `POST /api/ingestion/jobs` avec `jobType` ∈ `verify|ocr|extract|upload|quality|pipeline`.  
Détails : [docs/CYCLE_C1.md](../docs/CYCLE_C1.md).

**Trou ouvert :** `11_Numerique_communications/` est désormais vide. Aucune source
sur la protection des données, la cybersécurité ou les communications
électroniques. Le texte authentique de la loi n° 2024-017 reste à récupérer.

Le doublon `Reglement_04-18` (présent dans `06_Fiscal_douanes_changes/` et
`14_Banque_COBAC/`, SHA256 identique) a été résolu le même jour : copie COBAC
écartée, copie `06_Fiscal` conservée. Plus aucun doublon binaire dans le corpus.

### Reste à corriger

**Date des règlements CEMAC.** `02_extract.py` déduit l'année du numéro. Sur les
textes numérotés `NN-AA` (n° 04/18 = 4ᵉ règlement de 2018), il lit `04-18` et
déduit 2004. Le champ `numero` reste juste, `date_texte` est faux. Sans incidence
sur la recherche, gênant si un filtrage chronologique est ajouté.

**Loi n° 2024-017** à récupérer (cf. ci-dessus) — `11_Numerique_communications/`
est vide.

## Prérequis

```
pip install -r scripts/requirements.txt
```

OCR (Windows) :

```
winget install UB-Mannheim.TesseractOCR
# Ghostscript : télécharger l'installeur 64-bit (winget n'a plus le paquet)
# https://ghostscript.com/releases/gsdnld.html
```

Le pack de langue française (`fra`) de Tesseract doit être coché à l'installation.
Sinon : placer `fra.traineddata` (tessdata_fast) dans tessdata, ou dans
`%LOCALAPPDATA%\tesseract\tessdata` — le script pointe `TESSDATA_PREFIX` dessus.

## Configuration

Créer `.env.local` à la racine (jamais commité, cf. `.gitignore`) :

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Settings > API > service_role>
OPENAI_API_KEY=sk-...

NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Settings > API > anon public>
```

La `service_role` contourne RLS. Jamais préfixée `NEXT_PUBLIC_`, jamais côté client,
jamais committée. Elle ne sert qu'à `03_upload.py`.

## Ordre d'exécution

```bash
# 0. Contrôle d'intégrité — doublons, fichiers mal étiquetés, PDF scannés
python scripts/00_verifier_corpus.py

# 1. Schéma : coller supabase/schema.sql dans Supabase Studio > SQL Editor

# 2. OCR des 50 PDF scannés (583 p.) — reprise automatique
python scripts/01_ocr.py --dry-run     # inventaire + durée estimée
python scripts/01_ocr.py

# 3. Extraction + découpage par article  (hors ligne, quelques minutes)
python scripts/02_extract.py

# 4. Estimation puis ingestion
python scripts/03_upload.py --estimation
python scripts/03_upload.py
```

### OCR — ce qui a été mesuré

Chaîne validée de bout en bout : `ocrmypdf` + `tesseract fra` + `ghostscript`,
sur des scans COBAC réels. Accents et cédilles corrects.

| | |
|---|---|
| Fichiers à océriser | 50 |
| Pages | 583 |
| Vitesse mesurée | 2,2 à 13 s/page |
| Durée attendue | 25 min à 2 h |

L'écart vient de la résolution des scans : les circulaires COBAC tournent à
~2,4 s/page, une instruction scannée en 2490 × 3499 monte à 13 s/page.
`--dry-run` affiche une estimation à partir du nombre réel de pages.

Le préflight échoue immédiatement si `ocrmypdf`, `tesseract`, le pack `fra` ou
`ghostscript` manquent, avec la commande d'installation exacte pour chacun.
Rien n'est lancé tant que la chaîne n'est pas complète.

`--budget N` arrête proprement après N secondes ; le lancement suivant reprend
au fichier exact où il s'est arrêté. `legal-content/_ocr/` ne reçoit que les
fichiers océrisés, jamais de copie des PDF déjà lisibles.

`--temp-local` océrise via un dossier temporaire local. À utiliser uniquement si
`legal-content/` est sur un lecteur réseau : sur volume lent, le même fichier
passe de 40 s+ à 26 s, le CPU étant à l'arrêt pendant les entrées-sorties.
Inutile sur disque local.

Contrôle final, dans Supabase :

```sql
select * from v_ingestion_status;
```

## Découpage : un chunk = un article

Le découpage suit les frontières d'articles, pas une fenêtre de tokens fixe.
En droit, la citation se fait à l'article : un chunk qui coupe au milieu de
l'article 12 produit une réponse citant « article 12 » avec un contenu tronqué.

Conséquences dans `02_extract.py` :

- un article court (« Art. 9. Abrogé. ») reste un chunk séparé — le fusionner
  avec le précédent lui ferait perdre sa référence de citation ;
- un article très long est fractionné, mais chaque partie porte le label
  `Article 12 (2/3)` et un rappel en tête ;
- les documents sans structure d'article (rapports, communiqués, annexes) sont
  découpés en blocs de 1 500 caractères, avec `article_num = NULL`.

La détection couvre `Article premier.`, `Art. 2.`, `Art.4.` (sans espace),
`Art 15.` (sans point), `Article 32-Le` (tiret collé) et `\f Art. 3.` (saut de
page). Chacun de ces cas casse une regex naïve et fait disparaître silencieusement
des articles entiers — vérifié sur trois textes, zéro trou dans la numérotation.

## Recherche hybride

`search_legal_base` fusionne un rang vectoriel et un rang plein texte (RRF).
Le vectoriel seul rate les termes exacts fréquents en OHADA (« nantissement »,
« AUSCGIE », « R-2010-01 ») ; le plein texte seul rate les reformulations.

L'application appelle `POST /api/recherche-legale`, qui calcule l'embedding côté
serveur pour que la clé OpenAI ne parte jamais au navigateur. Sans clé OpenAI, la
route dégrade automatiquement vers le plein texte.

## Fichiers

| Fichier | Rôle |
|---|---|
| `00_verifier_corpus.py` | intégrité du corpus avant ingestion |
| `01_ocr.py` | OCR des PDF scannés → `legal-content/_ocr/` |
| `02_extract.py` | extraction + découpage → `build/chunks.jsonl` |
| `03_upload.py` | embeddings + envoi Supabase |
| `../supabase/schema.sql` | tables, index, RLS, RPC de recherche |
| `../src/lib/supabase.ts` | client navigateur (anon, lecture seule) |
| `../src/lib/baseLegale.ts` | fonctions de recherche et de citation |
| `../src/app/api/recherche-legale/route.ts` | route serveur d'embedding + recherche |
