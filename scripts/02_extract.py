#!/usr/bin/env python3
"""
JurisLex — Étape 2 : extraction du texte + découpage par article.

Pourquoi un découpage par article et non par fenêtre de tokens :
en droit, la citation se fait à l'article. Un chunk qui coupe au milieu de
l'article 12 produit une réponse qui cite « article 12 » avec un contenu
tronqué — faux et dangereux dans un contexte notarial.

Le script :
  1. extrait le texte page par page (pdftotext si dispo, sinon pypdf) ;
  2. détecte les frontières d'articles ;
  3. constitue un chunk par article, en fusionnant les articles très courts
     et en fractionnant les articles très longs (avec suffixe de partie) ;
  4. déduit les métadonnées du nom de fichier et du dossier ;
  5. écrit un JSONL dans build/chunks.jsonl.

Aucun réseau requis. Se lance sans clé API.

Entrée par défaut : legal-content/ (+ legal-content/_ocr/ prioritaire si présent).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "build" / "chunks.jsonl"
RAPPORT = RACINE / "build" / "rapport_extraction.json"

# Cible ~1800 caractères ≈ 450 tokens : marge confortable sous la limite
# de text-embedding-3-small (8191 tokens) et assez large pour un article entier.
# Quarantaine / artefacts — voir legal-content/_ecartes/POURQUOI.md
EXCLUS = frozenset({"_ecartes", "_ocr"})


def est_exclu(chemin: Path) -> bool:
    return not EXCLUS.isdisjoint(chemin.parts)

MIN_CHARS = 250
MAX_CHARS = 6000
FUSION_MAX = 1800

# ------------------------------------------------------------------
# Détection des articles
# Couvre : "Article 5.-", "ARTICLE 5 :", "Art. 5", "Article 12 bis",
#          "Article 34 (nouveau)", "Article premier"
# ------------------------------------------------------------------
# Le corpus mélange 'Article premier.', 'Art. 2.', 'Art.4.' (sans espace),
# 'Art 15.' (sans point) et '\x0cArt. 3.' (saut de page collé au mot).
# Les trois derniers cas cassent une regex naïve : séparateur optionnel et
# saut de page admis en tête de ligne.
RE_ARTICLE = re.compile(
    r"^[ \t\f ]*"
    r"(?P<label>"
    r"ART(?:ICLE)?"
    r"[ \t ]*\.?[ \t ]*"          # 'Art. 2' | 'Art.4' | 'Art 15' | 'Article5'
    r"(?:N[°ºo]?[ \t]*)?"                    # 'Art. N° 12'
    r"(?P<num>premier|1er|\d{1,4})"
    r"(?:[ \t ]*(?P<suffixe>bis|ter|quater|quinquies))?"
    r"(?:[ \t ]*\(?(?P<nouveau>nouveau|nouvelle)\)?)?"
    r")"
    # Terminaison : ponctuation ('Article 32-Le', tiret colle au mot suivant),
    # espace, ou fin de ligne.
    r"[ \t]*(?:[\.\-\u2013\u2014:)]+[ \t]*|[ \t]+|$)",
    re.IGNORECASE | re.MULTILINE,
)

TYPES_ACTE = [
    ("acte_uniforme", r"acte[_ ]?uniforme|^AU[A-Z]"),
    ("Loi", r"^loi\b"),
    ("Décret", r"^decret\b"),
    ("Ordonnance", r"^ordonnance\b"),
    ("Arrêté", r"^arrete\b"),
    ("Règlement", r"^regl?e?ment\b|^rglt|^R-\d|^r_?\d{4}"),
    ("Circulaire", r"^circulaire\b|^lc[-_]"),
    ("Instruction", r"^instruction\b"),
    ("Décision", r"^decision\b|^d?cobac_d"),
    ("Code", r"^code\b|^cima_code"),
    ("Constitution", r"^constitution\b"),
    ("Journal officiel", r"^jo[_ ]|journal_officiel"),
]

JURIDICTIONS = [
    ("OHADA", r"ohada|acte_uniforme|auscgie|aus\b"),
    ("COBAC", r"cobac"),
    ("CEMAC", r"cemac|umac"),
    ("CIMA", r"\bcima\b"),
    ("OAPI", r"oapi"),
    ("UDEAC", r"udeac"),
    ("Cameroun", r".*"),  # défaut
]


def sans_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def normaliser_nom(nom: str) -> str:
    """'67_Loi_2016-007_code_penal' -> 'loi 2016-007 code penal'.

    Le préfixe numérique d'ordre est retiré et les '_' deviennent des espaces :
    sans ça, '\\b' après 'ordonnance' ne se déclenche pas ('ordonnance_74' n'a
    pas de frontière de mot, '_' étant un caractère de mot).
    """
    n = re.sub(r"^\d{1,3}[_-]", "", nom)
    return re.sub(r"\s+", " ", sans_accents(n).replace("_", " ")).strip().lower()


def deviner_type(nom: str) -> str | None:
    n = normaliser_nom(nom)
    for etiquette, motif in TYPES_ACTE:
        if re.search(motif, n, re.IGNORECASE):
            return "Acte uniforme" if etiquette == "acte_uniforme" else etiquette
    return None


def deviner_juridiction(chemin_rel: str) -> str:
    n = sans_accents(chemin_rel).lower()
    for etiquette, motif in JURIDICTIONS:
        if re.search(motif, n, re.IGNORECASE):
            return etiquette
    return "Cameroun"


def deviner_numero_et_date(nom: str) -> tuple[str | None, str | None]:
    """Extrait le numéro de texte et l'année si présents.

    'Loi_2016-007_code_penal'      -> ('2016-007', 2016)
    'Ordonnance_74-1_regime...'    -> ('74-1',     1974)
    '67_rgltcobacr_2008_01'        -> ('2008-01',  2008)
    'R-2010-01'                    -> ('R-2010-01', 2010)
    """
    n = normaliser_nom(nom)

    # Référence COBAC/CEMAC : R-2010-01, R 2001 03, R93-13
    m = re.search(r"\br[-_ ]?(\d{2,4})[-_ ](\d{1,4})\b", n)
    if m:
        annee = _annee(m.group(1))
        return f"R-{m.group(1)}-{m.group(2)}", annee

    # Numéro standard : 2016-007, 74-1, 2008 01
    m = re.search(r"\b(\d{2,4})[-_ ](\d{1,4})\b", n)
    if m:
        return f"{m.group(1)}-{m.group(2)}", _annee(m.group(1))

    return None, None


def _annee(fragment: str) -> str | None:
    """'2016' -> '2016-01-01' ; '74' -> '1974-01-01'. Date approchée : seule
    l'année est fiable depuis un nom de fichier, le jour ne l'est jamais."""
    v = int(fragment)
    if len(fragment) == 2:
        v = 1900 + v if v >= 50 else 2000 + v
    if 1950 <= v <= date.today().year:
        return f"{v}-01-01"
    return None


def titre_lisible(nom_fichier: str) -> str:
    t = re.sub(r"^\d+[_-]", "", nom_fichier)
    t = t.replace("_", " ").replace("-", " ")
    t = re.sub(r"\s+", " ", t).strip()
    return t[:1].upper() + t[1:]


def extraire_pages(pdf: Path) -> list[str]:
    """Texte page par page. pdftotext -layout d'abord, pypdf en secours."""
    try:
        # stderr ignoré : pdftotext déverse des milliers de lignes
        # 'Object N 0 found' sur les PDF malformés, sans incidence.
        r = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", str(pdf), "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, errors="replace", timeout=900,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.split("\f")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    try:
        from pypdf import PdfReader

        return [(p.extract_text() or "") for p in PdfReader(str(pdf)).pages]
    except Exception as e:
        print(f"    ! extraction impossible : {e}")
        return []


def nettoyer(texte: str) -> str:
    texte = texte.replace("­", "")                  # trait d'union conditionnel
    texte = re.sub(r"(\w)-\n(\w)", r"\1\2", texte)       # césure de fin de ligne
    texte = re.sub(r"[ \t]+", " ", texte)
    texte = re.sub(r"\n{3,}", "\n\n", texte)
    return texte.strip()


def normaliser_num(m: re.Match) -> str:
    num = m.group("num").lower()
    if num in ("premier", "1er"):
        num = "1"
    if m.group("suffixe"):
        num += " " + m.group("suffixe").lower()
    if m.group("nouveau"):
        num += " nouveau"
    return num


def index_pages(pages: list[str]) -> list[tuple[int, int]]:
    """[(offset_debut, numero_page)] dans le texte concaténé."""
    idx, pos = [], 0
    for i, p in enumerate(pages, 1):
        idx.append((pos, i))
        pos += len(p) + 1
    return idx


def page_de(offset: int, idx: list[tuple[int, int]]) -> int:
    page = 1
    for debut, n in idx:
        if debut <= offset:
            page = n
        else:
            break
    return page


def decouper(texte: str, idx: list[tuple[int, int]]) -> list[dict]:
    """Découpe par article ; repli sur des blocs si aucun article détecté."""
    marques = list(RE_ARTICLE.finditer(texte))
    morceaux: list[dict] = []

    if not marques:
        # Pas de structure d'article (annexes, tableaux, JO composites).
        pas = 1500
        for i in range(0, len(texte), pas):
            bloc = texte[i : i + pas].strip()
            if len(bloc) >= MIN_CHARS:
                morceaux.append(
                    {
                        "article_num": None,
                        "article_label": None,
                        "contenu": bloc,
                        "page_debut": page_de(i, idx),
                        "page_fin": page_de(min(i + pas, len(texte) - 1), idx),
                    }
                )
        return morceaux

    # Préambule avant le premier article
    if marques[0].start() > MIN_CHARS:
        preambule = texte[: marques[0].start()].strip()
        morceaux.append(
            {
                "article_num": None,
                "article_label": "Préambule",
                "contenu": preambule[:MAX_CHARS],
                "page_debut": 1,
                "page_fin": page_de(marques[0].start(), idx),
            }
        )

    for i, m in enumerate(marques):
        debut = m.start()
        fin = marques[i + 1].start() if i + 1 < len(marques) else len(texte)
        corps = texte[debut:fin].strip()
        if not corps:
            continue

        num = normaliser_num(m)
        label = f"Article {num}"
        p_debut, p_fin = page_de(debut, idx), page_de(fin - 1, idx)

        if len(corps) <= MAX_CHARS:
            morceaux.append(
                {
                    "article_num": num,
                    "article_label": label,
                    "contenu": corps,
                    "page_debut": p_debut,
                    "page_fin": p_fin,
                }
            )
        else:
            # Article très long : fractionner aux paragraphes, en réinjectant
            # le label dans chaque partie pour que la citation reste juste.
            parties, courant = [], ""
            for para in corps.split("\n\n"):
                if len(courant) + len(para) > MAX_CHARS and courant:
                    parties.append(courant.strip())
                    courant = ""
                courant += para + "\n\n"
            if courant.strip():
                parties.append(courant.strip())
            for k, partie in enumerate(parties, 1):
                entete = "" if k == 1 else f"[{label} — suite {k}/{len(parties)}]\n"
                morceaux.append(
                    {
                        "article_num": num,
                        "article_label": f"{label} ({k}/{len(parties)})" if len(parties) > 1 else label,
                        "contenu": entete + partie,
                        "page_debut": p_debut,
                        "page_fin": p_fin,
                    }
                )

    # Un article court ('Art. 9. Abrogé.') reste un chunk à part entière.
    # Le fusionner avec le précédent lui ferait perdre son label, donc sa
    # référence de citation : l'article 9 deviendrait invisible et son
    # contenu serait attribué à l'article 8. Inacceptable en matière notariale.
    # Seuls les fragments SANS numéro d'article sont fusionnés.
    fusionnes: list[dict] = []
    for mc in morceaux:
        if (
            fusionnes
            and mc["article_num"] is None
            and fusionnes[-1]["article_num"] is None
            and len(mc["contenu"]) < MIN_CHARS
            and len(fusionnes[-1]["contenu"]) + len(mc["contenu"]) < FUSION_MAX
        ):
            fusionnes[-1]["contenu"] += "\n\n" + mc["contenu"]
            fusionnes[-1]["page_fin"] = mc["page_fin"]
        else:
            fusionnes.append(mc)
    return fusionnes


def sha256(chemin: Path) -> str:
    h = hashlib.sha256()
    with chemin.open("rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=None)
    ap.add_argument("--limite", type=int, default=None, help="n premiers PDF (test)")
    args = ap.parse_args()

    racine_src = args.source or RACINE / "legal-content"
    if not racine_src.is_dir():
        print(f"ERREUR : {racine_src} introuvable")
        return 1

    # legal-content/_ocr/ ne contient que les fichiers océrisés. Pour chaque PDF
    # du corpus on prend la version océrisée si elle existe, l'originale sinon.
    racine_ocr = racine_src / "_ocr" if args.source is None else None
    ocr_dispo = racine_ocr.is_dir() if racine_ocr else False

    print(f"Source : {racine_src}")
    if ocr_dispo:
        n_ocr = len(list(racine_ocr.rglob("*.pdf")))
        print(f"         + _ocr/ ({n_ocr} fichiers océrisés, prioritaires)")
    else:
        print("ATTENTION : legal-content/_ocr/ absent — les PDF scannés produiront 0 chunk.\n"
              "            Lancer 01_ocr.py d'abord.\n")

    pdfs = sorted(p for p in racine_src.rglob("*.pdf") if not est_exclu(p))
    if args.limite:
        pdfs = pdfs[: args.limite]

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    stats = {"documents": 0, "chunks": 0, "vides": [], "sans_article": [], "par_categorie": {}}

    with SORTIE.open("w", encoding="utf-8") as sortie:
        for i, pdf in enumerate(pdfs, 1):
            rel = pdf.relative_to(racine_src)
            categorie = rel.parts[0] if len(rel.parts) > 1 else "racine"
            nom = pdf.stem

            fichier = pdf
            est_ocr = False
            if ocr_dispo and (racine_ocr / rel).exists():
                fichier = racine_ocr / rel
                est_ocr = True

            pages = extraire_pages(fichier)
            texte = nettoyer("\f".join(pages))
            if len(texte) < 500:
                print(f"[{i}/{len(pdfs)}] VIDE  {rel}")
                stats["vides"].append(str(rel))
                continue

            idx = index_pages(pages)
            morceaux = decouper(texte, idx)
            avec_article = sum(1 for m in morceaux if m["article_num"])
            if avec_article == 0:
                stats["sans_article"].append(str(rel))

            numero, date_texte = deviner_numero_et_date(nom)
            doc = {
                "slug": re.sub(r"[^a-z0-9]+", "-", sans_accents(str(rel.with_suffix(""))).lower()).strip("-"),
                "titre": titre_lisible(nom),
                "type_acte": deviner_type(nom),
                "numero": numero,
                "date_texte": date_texte,
                "juridiction": deviner_juridiction(str(rel)),
                "categorie": categorie,
                "source_path": str(rel).replace("\\", "/"),
                # sha256 de l'ORIGINAL, pas de la version océrisée : c'est la
                # pièce de référence, et il doit rester comparable au
                # SHA256SUMS.txt du dossier 99_Registre.
                "sha256": sha256(pdf),
                "nb_pages": len(pages),
                "ocr": est_ocr,
            }

            for k, mc in enumerate(morceaux):
                sortie.write(
                    json.dumps(
                        {"document": doc, "chunk_index": k, **mc, "nb_tokens": len(mc["contenu"]) // 4},
                        ensure_ascii=False,
                    )
                    + "\n"
                )

            stats["documents"] += 1
            stats["chunks"] += len(morceaux)
            stats["par_categorie"].setdefault(categorie, {"docs": 0, "chunks": 0})
            stats["par_categorie"][categorie]["docs"] += 1
            stats["par_categorie"][categorie]["chunks"] += len(morceaux)

            print(
                f"[{i}/{len(pdfs)}] {len(morceaux):5d} chunks "
                f"({avec_article} articles, {len(pages)} p.)  {rel}"
            )

    RAPPORT.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n--- Bilan ---")
    print(f"documents : {stats['documents']}")
    print(f"chunks    : {stats['chunks']}")
    print(f"PDF vides : {len(stats['vides'])}")
    print(f"sans article détecté : {len(stats['sans_article'])}")
    print(f"\nSortie  : {SORTIE}")
    print(f"Rapport : {RAPPORT}")
    if stats["vides"]:
        print("\nPDF sans texte exploitable (OCR requis) :")
        for v in stats["vides"][:20]:
            print(f"  - {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
