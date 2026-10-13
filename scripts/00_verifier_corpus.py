#!/usr/bin/env python3
"""
JurisLex — Étape 0 : contrôle d'intégrité du corpus AVANT ingestion.

Motivation concrète : le fichier
    11_Numerique_communications/Loi_2024-017_protection_donnees_personnelles.pdf
ne contient pas la loi sur la protection des données personnelles, mais le
bulletin « N° 80 – Novembre/Décembre 2024 » du Cabinet Civil de la Présidence.
Le même fichier est dupliqué sous un autre nom dans 19_Famille_enfance_protection/.

Ingéré tel quel, le moteur citerait « Loi n° 2024-017, article X » en s'appuyant
sur un communiqué présidentiel. En matière notariale, une citation fausse et
confiante est pire que l'absence de réponse.

Ce script détecte :
  1. doublons binaires (SHA256 identique, noms différents) ;
  2. incohérence nom de fichier / contenu (aucun mot-clé du nom en première page) ;
  3. PDF sans couche texte (OCR requis) ;
  4. PDF illisibles ou corrompus.

Sortie : build/rapport_integrite.json + résumé console.
Aucun réseau requis.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SOURCES = RACINE / "legal-content"
RAPPORT = RACINE / "build" / "rapport_integrite.json"

SEUIL_TEXTE = 200

# Quarantaine : fichiers dont le contenu ne correspond pas au nom.
# Quarantaine / artefacts OCR — voir legal-content/_ecartes/POURQUOI.md
EXCLUS = frozenset({"_ecartes", "_ocr"})


def est_exclu(chemin: Path) -> bool:
    return not EXCLUS.isdisjoint(chemin.parts)

# Mots trop génériques pour prouver quoi que ce soit sur le contenu
VIDES = {
    "loi", "decret", "arrete", "ordonnance", "reglement", "acte", "code",
    "circulaire", "instruction", "decision", "source", "secondaire",
    "version", "officielle", "modification", "completant", "portant",
    "relatif", "relative", "edition", "final", "n", "de", "du", "des",
    "la", "le", "les", "et", "aux", "sur", "par", "pour", "cemac", "cobac",
}


def sans_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def mots_cles(nom: str) -> list[str]:
    n = sans_accents(nom).lower()
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return [m for m in n.split() if len(m) >= 4 and m not in VIDES and not m.isdigit()]


def sha256(chemin: Path) -> str:
    h = hashlib.sha256()
    with chemin.open("rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def texte_debut(pdf: Path, pages: int = 3) -> str:
    try:
        r = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", "-l", str(pages), str(pdf), "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, errors="replace", timeout=300,
        )
        return r.stdout or ""
    except Exception:
        return ""


def main() -> int:
    if not SOURCES.is_dir():
        print(f"ERREUR : {SOURCES} introuvable")
        return 1

    pdfs = sorted(p for p in SOURCES.rglob("*.pdf") if not est_exclu(p))
    print(f"Contrôle de {len(pdfs)} PDF...\n")

    par_hash: dict[str, list[str]] = defaultdict(list)
    scannes: list[str] = []
    suspects: list[dict] = []
    illisibles: list[str] = []

    for i, pdf in enumerate(pdfs, 1):
        rel = str(pdf.relative_to(SOURCES)).replace("\\", "/")
        try:
            par_hash[sha256(pdf)].append(rel)
        except Exception as e:
            illisibles.append(f"{rel} : {e}")
            continue

        txt = texte_debut(pdf)
        compact = "".join(txt.split())
        if len(compact) < SEUIL_TEXTE:
            scannes.append(rel)
            continue  # sans texte, la cohérence n'est pas vérifiable ici

        cles = mots_cles(pdf.stem)
        if not cles:
            continue
        norm = sans_accents(txt).lower()
        trouves = [k for k in cles if k in norm]
        if not trouves:
            suspects.append(
                {
                    "fichier": rel,
                    "mots_cles_attendus": cles,
                    "debut_reel": " ".join(txt.split())[:180],
                }
            )
        if i % 20 == 0:
            print(f"  {i}/{len(pdfs)}")

    doublons = {h: f for h, f in par_hash.items() if len(f) > 1}

    rapport = {
        "total_pdf": len(pdfs),
        "doublons": [{"sha256": h, "fichiers": f} for h, f in doublons.items()],
        "sans_couche_texte": scannes,
        "contenu_suspect": suspects,
        "illisibles": illisibles,
    }
    RAPPORT.parent.mkdir(parents=True, exist_ok=True)
    RAPPORT.write_text(json.dumps(rapport, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'='*70}\nRAPPORT D'INTÉGRITÉ\n{'='*70}")
    print(f"PDF analysés          : {len(pdfs)}")
    print(f"Doublons binaires     : {len(doublons)} groupe(s)")
    print(f"Sans couche texte     : {len(scannes)} (OCR requis)")
    print(f"Contenu suspect       : {len(suspects)}")
    print(f"Illisibles            : {len(illisibles)}")

    if doublons:
        print(f"\n--- DOUBLONS (même fichier, noms différents) ---")
        for h, f in doublons.items():
            print(f"  {h[:16]}...")
            for x in f:
                print(f"    - {x}")

    if suspects:
        print(f"\n--- CONTENU SUSPECT (nom ≠ contenu) ---")
        print("  À vérifier manuellement avant ingestion.\n")
        for s in suspects:
            print(f"  {s['fichier']}")
            print(f"    attendu  : {', '.join(s['mots_cles_attendus'][:6])}")
            print(f"    trouvé   : {s['debut_reel'][:120]}")
            print()

    print(f"Rapport complet : {RAPPORT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
