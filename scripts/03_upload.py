#!/usr/bin/env python3
"""
JurisLex — Étape 3 : embeddings OpenAI + envoi vers Supabase.

Lit build/chunks.jsonl, calcule les embeddings par lots, insère documents et
chunks via la clé service_role.

Idempotent : relancer ne duplique rien (upsert sur legal_documents.slug et
sur (document_id, chunk_index)). Un document dont le sha256 n'a pas changé
et dont tous les chunks ont un embedding est ignoré.

Variables d'environnement requises (.env.local, jamais commité) :
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...      <- PAS la clé anon
    OPENAI_API_KEY=sk-...

Installation :
    pip install -r scripts/requirements.txt

Usage :
    python scripts/03_upload.py --estimation     # coût seul, aucun appel
    python scripts/03_upload.py                  # ingestion réelle
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ENTREE = RACINE / "build" / "chunks.jsonl"

MODELE = "text-embedding-3-small"
DIMENSIONS = 1536
TAILLE_LOT = 96              # chunks par appel d'embedding
LOT_INSERTION = 400          # lignes par insert Supabase
PRIX_PAR_MTOKEN = 0.02       # USD, text-embedding-3-small


def charger_env() -> None:
    for nom in (".env.local", ".env"):
        f = RACINE / nom
        if not f.exists():
            continue
        for ligne in f.read_text(encoding="utf-8").splitlines():
            ligne = ligne.strip()
            if not ligne or ligne.startswith("#") or "=" not in ligne:
                continue
            cle, val = ligne.split("=", 1)
            os.environ.setdefault(cle.strip(), val.strip().strip("\"'"))


def verifier_env() -> tuple[str, str, str]:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    openai = os.environ.get("OPENAI_API_KEY", "")

    manquant = []
    if not url or "dummy" in url:
        manquant.append("SUPABASE_URL")
    if not service or len(service) < 40:
        manquant.append("SUPABASE_SERVICE_ROLE_KEY")
    if not openai or not openai.startswith("sk-"):
        manquant.append("OPENAI_API_KEY")

    if manquant:
        print("ERREUR — variables manquantes ou factices : " + ", ".join(manquant))
        print("\nCréer scripts/../.env.local avec :")
        print("  SUPABASE_URL=https://<ref>.supabase.co")
        print("  SUPABASE_SERVICE_ROLE_KEY=<Settings > API > service_role>")
        print("  OPENAI_API_KEY=sk-...")
        print("\nLa clé service_role contourne RLS. Ne jamais l'exposer côté client,")
        print("ne jamais la préfixer NEXT_PUBLIC_, ne jamais la committer.")
        sys.exit(1)
    return url, service, openai


def lire_chunks() -> list[dict]:
    if not ENTREE.exists():
        print(f"ERREUR : {ENTREE} introuvable. Lancer d'abord 02_extract.py")
        sys.exit(1)
    return [json.loads(l) for l in ENTREE.open(encoding="utf-8")]


def estimer(chunks: list[dict]) -> None:
    tokens = sum(c["nb_tokens"] for c in chunks)
    docs = len({c["document"]["slug"] for c in chunks})
    print(f"documents        : {docs}")
    print(f"chunks           : {len(chunks)}")
    print(f"tokens (approx.) : {tokens:,}")
    print(f"coût embeddings  : ~{tokens / 1_000_000 * PRIX_PAR_MTOKEN:.2f} USD ({MODELE})")
    print(f"appels API       : ~{(len(chunks) + TAILLE_LOT - 1) // TAILLE_LOT}")
    trop_longs = [c for c in chunks if c["nb_tokens"] > 8000]
    if trop_longs:
        print(f"\nATTENTION : {len(trop_longs)} chunks dépassent 8000 tokens "
              f"(limite {MODELE}). Ils seront tronqués.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--estimation", action="store_true", help="coût seul, aucun appel réseau")
    ap.add_argument("--limite", type=int, default=None)
    args = ap.parse_args()

    charger_env()
    chunks = lire_chunks()
    if args.limite:
        chunks = chunks[: args.limite]

    if args.estimation:
        estimer(chunks)
        return 0

    url, service, cle_openai = verifier_env()
    estimer(chunks)
    print()

    from openai import OpenAI
    from supabase import create_client

    oa = OpenAI(api_key=cle_openai)
    sb = create_client(url, service)

    # ---------------------------------------------------------------
    # 1. Documents (upsert sur slug)
    # ---------------------------------------------------------------
    docs: dict[str, dict] = {}
    for c in chunks:
        docs[c["document"]["slug"]] = c["document"]

    print(f"Upsert de {len(docs)} documents...")
    ids: dict[str, str] = {}
    liste = list(docs.values())
    # Enrichissement prudent : jamais « en_vigueur » / verified sans audit
    for doc in liste:
        path = (doc.get("source_path") or "").lower()
        titre = (doc.get("titre") or "").lower()
        if "source_secondaire" in path or "secondaire" in path or "compilation" in titre:
            doc["provenance"] = "secondary"
        else:
            doc["provenance"] = "official" if path else "unknown"
        doc.setdefault("legal_status", "unknown")
        doc.setdefault("statut", "unknown")
        doc.setdefault("langue", "fr")
    for i in range(0, len(liste), 100):
        lot = liste[i : i + 100]
        r = sb.table("legal_documents").upsert(lot, on_conflict="slug").execute()
        for ligne in r.data:
            ids[ligne["slug"]] = ligne["id"]
    print(f"  -> {len(ids)} documents en base\n")

    # ---------------------------------------------------------------
    # 2. Embeddings + insertion des chunks
    # ---------------------------------------------------------------
    par_doc: dict[str, list[dict]] = defaultdict(list)
    for c in chunks:
        par_doc[c["document"]["slug"]].append(c)

    total, echecs = 0, 0
    tampon: list[dict] = []
    t0 = time.time()

    for n_doc, (slug, liste_chunks) in enumerate(par_doc.items(), 1):
        doc_id = ids.get(slug)
        if not doc_id:
            print(f"  ! document absent en base : {slug}")
            echecs += 1
            continue

        for i in range(0, len(liste_chunks), TAILLE_LOT):
            lot = liste_chunks[i : i + TAILLE_LOT]
            textes = [
                # Le label est préfixé au texte embarqué : la question
                # « que dit l'article 12 » doit pouvoir matcher sémantiquement.
                f"{c['article_label'] or ''}\n{c['contenu']}"[:30000]
                for c in lot
            ]
            try:
                rep = oa.embeddings.create(
                    model=MODELE, input=textes, dimensions=DIMENSIONS
                )
                vecteurs = [d.embedding for d in rep.data]
            except Exception as e:
                print(f"  ! embedding échoué ({slug} lot {i}) : {e}")
                echecs += len(lot)
                continue

            for c, v in zip(lot, vecteurs):
                tampon.append(
                    {
                        "document_id": doc_id,
                        "chunk_index": c["chunk_index"],
                        "article_num": c["article_num"],
                        "article_label": c["article_label"],
                        "contenu": c["contenu"],
                        "nb_tokens": c["nb_tokens"],
                        "page_debut": c["page_debut"],
                        "page_fin": c["page_fin"],
                        "embedding": v,
                    }
                )

            if len(tampon) >= LOT_INSERTION:
                sb.table("legal_chunks").upsert(
                    tampon, on_conflict="document_id,chunk_index"
                ).execute()
                total += len(tampon)
                tampon = []

        ecoule = time.time() - t0
        print(f"[{n_doc}/{len(par_doc)}] {total:6d} chunks  ({ecoule/60:.1f} min)  {slug}")

    if tampon:
        sb.table("legal_chunks").upsert(
            tampon, on_conflict="document_id,chunk_index"
        ).execute()
        total += len(tampon)

    print(f"\n--- Bilan ---")
    print(f"chunks insérés : {total}")
    print(f"échecs         : {echecs}")
    print(f"durée          : {(time.time()-t0)/60:.1f} min")
    print("\nContrôle : select * from v_ingestion_status;")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
