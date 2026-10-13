#!/usr/bin/env python3
"""
JurisLex C1 — scores qualité post-extraction.

Lit build/chunks.jsonl (+ rapport_extraction / intégrité si présents)
et produit build/rapport_qualite.json avec un score 0–100 par document
et des flags (warning/error) pour file manuelle / quarantaine.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CHUNKS = RACINE / "build" / "chunks.jsonl"
RAPPORT_EXTRACT = RACINE / "build" / "rapport_extraction.json"
RAPPORT_INTEGRITE = RACINE / "build" / "rapport_integrite.json"
SORTIE = RACINE / "build" / "rapport_qualite.json"

DEFAULT_THRESHOLD = 55.0


def charger_chunks(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.open(encoding="utf-8") if l.strip()]


def score_document(slug: str, chunks: list[dict], integrite: dict | None) -> dict:
    flags: list[dict] = []
    n = len(chunks)
    if n == 0:
        return {
            "source_path": "",
            "document_slug": slug,
            "score": 0.0,
            "flags": [{"code": "no_chunks", "severity": "error", "message": "Aucun chunk"}],
            "metrics": {},
            "quarantined": True,
        }

    first = chunks[0]
    doc = first.get("document") or {}
    source_path = doc.get("source_path") or first.get("source_path") or ""

    with_article = sum(1 for c in chunks if c.get("article_num") or c.get("article_label"))
    pct_articles = 100.0 * with_article / n
    emptyish = sum(1 for c in chunks if len((c.get("contenu") or "").strip()) < 40)
    pct_empty = 100.0 * emptyish / n
    pages = set()
    for c in chunks:
        if c.get("page_debut"):
            pages.add(c["page_debut"])
        if c.get("page_fin"):
            pages.add(c["page_fin"])

    # Heuristique caractères douteux OCR (�, suites de symbol, etc.)
    suspect_chars = 0
    total_chars = 0
    for c in chunks:
        t = c.get("contenu") or ""
        total_chars += len(t)
        suspect_chars += t.count("\ufffd") + len(re.findall(r"[|]{3,}|\.{6,}|_{4,}", t))

    pct_suspect = (100.0 * suspect_chars / total_chars) if total_chars else 0.0

    # Score de base
    score = 100.0
    if pct_articles < 30:
        score -= 35
        flags.append({
            "code": "low_article_detection",
            "severity": "warning",
            "message": f"Seulement {pct_articles:.0f}% des chunks ont un n° d'article",
        })
    elif pct_articles < 60:
        score -= 15
        flags.append({
            "code": "medium_article_detection",
            "severity": "info",
            "message": f"{pct_articles:.0f}% des chunks ont un n° d'article",
        })

    if pct_empty > 10:
        score -= min(30, pct_empty)
        flags.append({
            "code": "short_chunks",
            "severity": "warning",
            "message": f"{pct_empty:.0f}% de chunks très courts (<40 car.)",
        })

    if pct_suspect > 2:
        score -= min(40, pct_suspect * 5)
        flags.append({
            "code": "ocr_noise",
            "severity": "error" if pct_suspect > 8 else "warning",
            "message": f"Bruit OCR estimé {pct_suspect:.1f}%",
        })

    if n < 3:
        score -= 10
        flags.append({
            "code": "few_chunks",
            "severity": "info",
            "message": f"Peu de chunks ({n})",
        })

    # Intégrité (doublons / mismatch nom)
    if integrite:
        for problem in integrite.get("problemes") or integrite.get("problems") or []:
            if not isinstance(problem, dict):
                continue
            path = str(problem.get("chemin") or problem.get("path") or "")
            if source_path and source_path.replace("\\", "/") in path.replace("\\", "/"):
                score -= 25
                flags.append({
                    "code": "integrity_" + str(problem.get("type") or "issue"),
                    "severity": "error",
                    "message": str(problem.get("message") or problem.get("detail") or problem),
                })

    score = max(0.0, min(100.0, round(score, 2)))
    threshold = DEFAULT_THRESHOLD
    quarantined = score < threshold or any(f["severity"] == "error" and f["code"].startswith("integrity") for f in flags)

    return {
        "source_path": source_path,
        "document_slug": slug,
        "score": score,
        "flags": flags,
        "metrics": {
            "nb_chunks": n,
            "pct_with_article": round(pct_articles, 2),
            "pct_short_chunks": round(pct_empty, 2),
            "pct_ocr_noise": round(pct_suspect, 2),
            "nb_pages_seen": len(pages),
            "total_chars": total_chars,
        },
        "quarantined": quarantined,
    }


def evaluer(
    chunks_path: Path = CHUNKS,
    threshold: float = DEFAULT_THRESHOLD,
) -> dict:
    chunks = charger_chunks(chunks_path)
    by_slug: dict[str, list[dict]] = defaultdict(list)
    for c in chunks:
        doc = c.get("document") or {}
        slug = doc.get("slug") or c.get("document_slug") or "unknown"
        by_slug[slug].append(c)

    integrite = None
    if RAPPORT_INTEGRITE.exists():
        try:
            integrite = json.loads(RAPPORT_INTEGRITE.read_text(encoding="utf-8"))
        except Exception:
            integrite = None

    reports = []
    for slug, group in sorted(by_slug.items()):
        r = score_document(slug, group, integrite)
        # Re-appliquer seuil demandé
        if r["score"] < threshold:
            r["quarantined"] = True
        reports.append(r)

    reports.sort(key=lambda x: x["score"])
    summary = {
        "documents": len(reports),
        "chunks": len(chunks),
        "avg_score": round(sum(r["score"] for r in reports) / len(reports), 2) if reports else 0,
        "quarantined": sum(1 for r in reports if r["quarantined"]),
        "threshold": threshold,
    }
    return {"summary": summary, "reports": reports}


def main() -> int:
    parser = argparse.ArgumentParser(description="Scores qualité corpus JurisLex")
    parser.add_argument("--chunks", type=Path, default=CHUNKS)
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--out", type=Path, default=SORTIE)
    args = parser.parse_args()

    result = evaluer(args.chunks, args.threshold)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    s = result["summary"]
    print(
        f"qualité: {s['documents']} docs, score moyen {s['avg_score']}, "
        f"quarantaine {s['quarantined']} (seuil {s['threshold']})"
    )
    print(f"→ {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
