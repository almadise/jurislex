#!/usr/bin/env python3
"""
JurisLex — Étape 1 : OCR des PDF scannés.

50 des 103 PDF du corpus n'ont aucune couche texte (COBAC, Code des marchés
publics, Code de justice militaire, Constitution officielle...). Sans OCR ils
sont invisibles à la recherche.

Sortie : legal-content/_ocr/, qui ne contient QUE les fichiers océrisés. Les PDF
déjà lisibles ne sont pas copiés — 02_extract.py lit legal-content/_ocr/<rel>
s'il existe, sinon legal-content/<rel>. Évite ~200 Mo de duplication.

Reprise : relancer le script saute ce qui est déjà fait (journal
.ocr_journal.json). L'option --budget N arrête proprement après N secondes,
pour découper le lot en tranches.

Un préflight vérifie ocrmypdf, tesseract, le pack de langue et ghostscript
AVANT de lancer le lot : sans lui, un pack manquant ne se révèle qu'au premier
fichier, après plusieurs minutes d'attente.

Prérequis Windows :
  winget install UB-Mannheim.TesseractOCR    (cocher French à l'installation)
  Ghostscript 64-bit : https://ghostscript.com/releases/gsdnld.html
    (le paquet winget ArtifexSoftware.GhostScript n'est plus publié)
  pip install ocrmypdf

Usage :
  python scripts/01_ocr.py --dry-run     # inventaire + durée estimée
  python scripts/01_ocr.py               # lot complet
  python scripts/01_ocr.py --budget 600  # tranche de 10 min, reprise ensuite
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SOURCES = RACINE / "legal-content"
SORTIE = RACINE / "legal-content" / "_ocr"
JOURNAL = RACINE / "scripts" / ".ocr_journal.json"

SEUIL_TEXTE = 200  # caractères non-blancs sur les 3 premières pages

# Quarantaine / artefacts — voir legal-content/_ecartes/POURQUOI.md
EXCLUS = frozenset({"_ecartes", "_ocr"})


def est_exclu(chemin: Path) -> bool:
    return not EXCLUS.isdisjoint(chemin.parts)


def charger_journal() -> dict:
    if JOURNAL.exists():
        return json.loads(JOURNAL.read_text(encoding="utf-8"))
    return {}


def sauver_journal(j: dict) -> None:
    JOURNAL.write_text(json.dumps(j, ensure_ascii=False, indent=2), encoding="utf-8")


def a_couche_texte(pdf: Path) -> bool:
    """True si les 3 premières pages contiennent du texte extractible."""
    try:
        from pypdf import PdfReader

        lecteur = PdfReader(str(pdf))
        texte = ""
        for page in lecteur.pages[:3]:
            texte += page.extract_text() or ""
        return len("".join(texte.split())) >= SEUIL_TEXTE
    except Exception as e:
        print(f"    ! lecture impossible ({e}) — traité comme scanné")
        return False


def _premier_existant(*candidats: Path) -> Path | None:
    for c in candidats:
        if c.exists():
            return c
    return None


def trouver_ocrmypdf() -> str | None:
    """ocrmypdf installé par pip atterrit souvent hors du PATH
    (~/.local/bin sous Linux, Scripts\\ sous Windows — y compris user site)."""
    trouve = shutil.which("ocrmypdf")
    if trouve:
        return trouve
    roaming = Path.home() / "AppData" / "Roaming" / "Python"
    user_scripts = sorted(roaming.glob("Python*/Scripts/ocrmypdf.exe"), reverse=True)
    candidats = [
        Path.home() / ".local" / "bin" / "ocrmypdf",
        Path(sys.prefix) / "Scripts" / "ocrmypdf.exe",
        Path(sys.prefix) / "bin" / "ocrmypdf",
        *user_scripts,
    ]
    for c in candidats:
        if c.exists():
            return str(c)
    return None


def trouver_tesseract() -> str | None:
    trouve = shutil.which("tesseract")
    if trouve:
        return trouve
    c = _premier_existant(
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        Path.home() / "AppData" / "Local" / "Programs" / "Tesseract-OCR" / "tesseract.exe",
    )
    return str(c) if c else None


def trouver_ghostscript() -> str | None:
    for nom in ("gs", "gswin64c", "gswin32c"):
        trouve = shutil.which(nom)
        if trouve:
            return trouve
    bins = sorted(Path(r"C:\Program Files\gs").glob("gs*/bin/gswin64c.exe"), reverse=True)
    bins += sorted(Path(r"C:\Program Files (x86)\gs").glob("gs*/bin/gswin32c.exe"), reverse=True)
    return str(bins[0]) if bins else None


def _tessdata_systeme(tess: str | None) -> Path | None:
    if not tess:
        return None
    d = Path(tess).resolve().parent / "tessdata"
    return d if d.is_dir() else None


def _assurer_tessdata_complet(langue: str) -> None:
    """Garantit un tessdata avec langue + configs (hocr requis par ocrmypdf).

    Sans droits admin, le pack fra peut vivre dans %LOCALAPPDATA%\\tesseract\\tessdata.
    Mais TESSDATA_PREFIX pointant sur ce dossier SANS configs/ provoque :
      read_params_file: Can't open hocr
    On y copie alors configs/ (et tessconfigs/) depuis l'install système.
    """
    tess = trouver_tesseract()
    sys_td = _tessdata_systeme(tess)
    user_td = Path.home() / "AppData" / "Local" / "tesseract" / "tessdata"

    # Préférer le tessdata système s'il a déjà la langue
    if sys_td and (sys_td / f"{langue}.traineddata").exists():
        prefix = os.environ.get("TESSDATA_PREFIX", "")
        if prefix and Path(prefix).resolve() == user_td.resolve():
            del os.environ["TESSDATA_PREFIX"]
        return

    if not (user_td / f"{langue}.traineddata").exists():
        return

    if sys_td:
        for sous in ("configs", "tessconfigs"):
            src = sys_td / sous
            if not src.is_dir():
                continue
            dst = user_td / sous
            dst.mkdir(parents=True, exist_ok=True)
            for f in src.iterdir():
                if f.is_file() and not (dst / f.name).exists():
                    shutil.copy2(f, dst / f.name)
        for extra in ("pdf.ttf",):
            if (sys_td / extra).exists() and not (user_td / extra).exists():
                shutil.copy2(sys_td / extra, user_td / extra)

    if (user_td / "configs" / "hocr").exists():
        os.environ["TESSDATA_PREFIX"] = str(user_td)


def assurer_path_outils(langue: str = "fra") -> None:
    """Ajoute au PATH les dossiers des binaires trouvés hors PATH.

    ocrmypdf cherche tesseract/gs via PATH dans ses sous-processus : les
    découvrir ne suffit pas, il faut les exposer pour toute la session.
    """
    dirs: list[str] = []
    for binaire in (trouver_ocrmypdf(), trouver_tesseract(), trouver_ghostscript()):
        if binaire:
            dirs.append(str(Path(binaire).resolve().parent))
    _assurer_tessdata_complet(langue)
    if not dirs:
        return
    courant = os.environ.get("PATH", "")
    prefixe = os.pathsep.join(dict.fromkeys(dirs))  # unique, ordre conservé
    os.environ["PATH"] = prefixe + os.pathsep + courant


def preflight(langue: str) -> str:
    """Vérifie la chaîne complète AVANT de lancer le lot.

    Sans ce contrôle, un pack de langue manquant ne se manifeste qu'au premier
    fichier — après plusieurs minutes d'attente, et sur 50 fichiers d'affilée.
    """
    assurer_path_outils(langue)
    problemes: list[str] = []

    binaire = trouver_ocrmypdf()
    if not binaire:
        problemes.append(
            "ocrmypdf introuvable\n"
            "      -> pip install ocrmypdf\n"
            "      (si installé, ajouter son dossier au PATH)"
        )

    tess = trouver_tesseract()
    if not tess:
        problemes.append(
            "tesseract introuvable\n"
            "      -> Windows : winget install UB-Mannheim.TesseractOCR\n"
            "      -> Debian  : apt install tesseract-ocr"
        )
    else:
        try:
            r = subprocess.run(
                [tess, "--list-langs"], capture_output=True, text=True, timeout=60
            )
            # Sortie type : 'List of available languages (2):\neng\nosd'
            # -> on ignore la ligne d'en-tête, une langue par ligne ensuite.
            lignes = (r.stdout + r.stderr).splitlines()
            dispo = [
                l.strip().rsplit("/", 1)[-1]
                for l in lignes
                if l.strip() and not l.lower().startswith("list of")
            ]
            if langue not in dispo:
                problemes.append(
                    f"pack de langue '{langue}' absent de tesseract "
                    f"(disponibles : {', '.join(dispo) or 'aucun'})\n"
                    f"      -> Windows : relancer l'installeur Tesseract et cocher French\n"
                    f"      -> Debian  : apt install tesseract-ocr-{langue}\n"
                    f"      -> sinon   : télécharger {langue}.traineddata depuis\n"
                    f"                   github.com/tesseract-ocr/tessdata_fast\n"
                    f"                   et le placer dans le dossier tessdata,\n"
                    f"                   ou pointer TESSDATA_PREFIX dessus"
                )
            # ocrmypdf exige le config 'hocr' dans tessdata/configs/
            prefix = os.environ.get("TESSDATA_PREFIX")
            candidats_hocr = []
            if prefix:
                candidats_hocr.append(Path(prefix) / "configs" / "hocr")
                candidats_hocr.append(Path(prefix) / "tessdata" / "configs" / "hocr")
            sys_td = _tessdata_systeme(tess)
            if sys_td:
                candidats_hocr.append(sys_td / "configs" / "hocr")
            if not any(p.exists() for p in candidats_hocr):
                problemes.append(
                    "config tesseract 'hocr' introuvable (requis par ocrmypdf)\n"
                    "      -> réinstaller Tesseract, ou copier configs/ depuis\n"
                    "         Program Files\\Tesseract-OCR\\tessdata\\configs\n"
                    "         vers le dossier pointé par TESSDATA_PREFIX"
                )
        except Exception as e:
            problemes.append(f"tesseract --list-langs a échoué : {e}")

    if not trouver_ghostscript():
        problemes.append(
            "ghostscript introuvable (requis par ocrmypdf)\n"
            "      -> Windows : télécharger l'installeur 64-bit depuis\n"
            "                   https://ghostscript.com/releases/gsdnld.html\n"
            "                   (le paquet winget ArtifexSoftware.GhostScript\n"
            "                   n'est plus publié)\n"
            "      -> Debian  : apt install ghostscript"
        )

    if problemes:
        print("PRÉFLIGHT ÉCHOUÉ — rien n'a été lancé.\n")
        for i, p in enumerate(problemes, 1):
            print(f"  {i}. {p}\n")
        sys.exit(2)

    print(f"Préflight OK — ocrmypdf, tesseract ({langue}), ghostscript présents.\n")
    return binaire  # type: ignore[return-value]


def ocr(
    binaire: str,
    entree: Path,
    sortie: Path,
    langue: str,
    jobs: int,
    temp_local: bool = False,
) -> tuple[bool, str]:
    """OCR d'un PDF.

    temp_local : copie l'entrée dans un dossier temporaire local, océrise, puis
    recopie le résultat. Utile quand legal-content/ est sur un volume lent (lecteur
    réseau, dossier monté) : mesuré ici 40 s+ → 26 s sur le même fichier, avec
    un CPU quasi inactif dans le premier cas. Inutile si le corpus est déjà sur
    un disque local.
    """
    sortie.parent.mkdir(parents=True, exist_ok=True)

    if temp_local:
        tmp = Path(tempfile.mkdtemp(prefix="jurislex_ocr_"))
        try:
            tmp_in, tmp_out = tmp / "in.pdf", tmp / "out.pdf"
            shutil.copy2(entree, tmp_in)
            ok, msg = _lancer(binaire, tmp_in, tmp_out, langue, jobs)
            if ok:
                shutil.copy2(tmp_out, sortie)
            return ok, msg
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    return _lancer(binaire, entree, sortie, langue, jobs)


def _lancer(binaire: str, entree: Path, sortie: Path, langue: str, jobs: int) -> tuple[bool, str]:
    cmd = [
        binaire,
        "--language", langue,
        "--rotate-pages",
        "--deskew",
        "--optimize", "1",
        "--skip-text",          # ne réécrit pas les pages ayant déjà du texte
        "--jobs", str(jobs),
        "--quiet",
        str(entree),
        str(sortie),
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)
        if r.returncode == 0:
            return True, "ok"
        return False, (r.stderr or r.stdout or "").strip()[:400]
    except FileNotFoundError:
        return False, "ocrmypdf introuvable — pip install ocrmypdf"
    except subprocess.TimeoutExpired:
        return False, "timeout (>2h)"


def compter_pages(pdf: Path) -> int:
    try:
        from pypdf import PdfReader

        return len(PdfReader(str(pdf)).pages)
    except Exception:
        return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="refaire même si déjà traité")
    ap.add_argument("--dry-run", action="store_true", help="lister et chiffrer sans exécuter")
    ap.add_argument("--langue", default="fra", help="langue tesseract (défaut : fra)")
    ap.add_argument("--jobs", type=int, default=4, help="processus parallèles (défaut : 4)")
    ap.add_argument("--temp-local", action="store_true",
                    help="ocerise via un dossier temporaire local (volume source lent)")
    ap.add_argument("--budget", type=int, default=None,
                    help="s'arrêter après N secondes (reprise au prochain lancement)")
    args = ap.parse_args()

    if not SOURCES.is_dir():
        print(f"ERREUR : {SOURCES} introuvable")
        return 1

    binaire = "ocrmypdf" if args.dry_run else preflight(args.langue)

    journal = {} if args.force else charger_journal()
    pdfs = sorted(p for p in SOURCES.rglob("*.pdf") if not est_exclu(p))
    print(f"{len(pdfs)} PDF trouvés dans {SOURCES}\n")

    a_ocr, copies, echecs, sautes = 0, 0, 0, 0
    pages_ocr = 0
    debut = time.time()

    for i, pdf in enumerate(pdfs, 1):
        rel = pdf.relative_to(SOURCES)
        cible = SORTIE / rel
        cle = str(rel)

        entree_journal = journal.get(cle, {})
        if not args.force and entree_journal.get("statut") == "ok":
            # Un fichier natif n'a pas de sortie dans _ocr/ ; seul un
            # fichier océrisé doit encore exister sur disque pour être sauté.
            if not entree_journal.get("ocr") or cible.exists():
                sautes += 1
                continue

        if args.budget and (time.time() - debut) > args.budget:
            print(f"\nBudget de {args.budget}s atteint, arrêt propre.")
            print("Relancer le script reprend exactement ici.")
            break

        taille_mo = pdf.stat().st_size / 1_048_576
        if a_couche_texte(pdf):
            # Aucune copie : _ocr/ ne contient QUE les fichiers océrisés.
            # 02_extract.py lit _ocr/<rel> s'il existe, sinon legal-content/<rel>.
            # Copier les 53 PDF déjà lisibles dupliquerait ~200 Mo pour rien.
            print(f"[{i}/{len(pdfs)}] texte OK  ({taille_mo:5.1f} Mo)  {rel}")
            if not args.dry_run:
                journal[cle] = {"statut": "ok", "ocr": False, "copie": False}
            copies += 1
        else:
            pages = compter_pages(pdf)
            pages_ocr += pages
            print(
                f"[{i}/{len(pdfs)}] OCR      ({taille_mo:5.1f} Mo, {pages:3d} p.)  {rel}",
                flush=True,
            )
            if args.dry_run:
                a_ocr += 1
                continue

            t0 = time.time()
            succes, msg = ocr(binaire, pdf, cible, args.langue, args.jobs, args.temp_local)
            duree = time.time() - t0
            if succes:
                vitesse = f", {duree/pages:.1f} s/page" if pages else ""
                print(f"          -> fait en {duree:.0f}s{vitesse}")
                journal[cle] = {
                    "statut": "ok", "ocr": True, "duree_s": round(duree), "pages": pages
                }
                a_ocr += 1
            else:
                print(f"          -> ECHEC : {msg}")
                journal[cle] = {"statut": "echec", "erreur": msg}
                echecs += 1
            sauver_journal(journal)

    if not args.dry_run:
        sauver_journal(journal)

    ecoule = time.time() - debut
    print(
        f"\n--- Bilan ---\n"
        f"copiés (texte natif) : {copies}\n"
        f"OCR effectués        : {a_ocr}\n"
        f"déjà faits (sautés)  : {sautes}\n"
        f"échecs               : {echecs}\n"
        f"durée totale         : {ecoule/60:.1f} min\n"
        f"sortie               : {SORTIE}"
    )

    if args.dry_run and pages_ocr:
        # ~2,5 s/page mesuré sur ce corpus avec 4 processus parallèles.
        # Les scans COBAC sont propres ; des pages plus bruitées seront plus lentes.
        est = pages_ocr * 2.5 / max(args.jobs / 4, 1)
        print(
            f"\npages à traiter      : {pages_ocr}\n"
            f"durée estimée        : ~{est/60:.0f} min (à ~2,5 s/page, {args.jobs} jobs)\n"
            f"\nLancer sans --dry-run pour exécuter."
        )

    if echecs:
        print("\nRelancer le script reprend uniquement les échecs.")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
