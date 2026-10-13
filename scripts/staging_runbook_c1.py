#!/usr/bin/env python3
"""
Runbook C1 staging — jurisLex Supabase
1) Applique 004_c1_staging_jurislex_adapt.sql via CLI link
2) Promote reviewer
3) Seed relations pilote
4) Génère dossier validation juriste (2–3 formules)

Usage:
  python scripts/staging_runbook_c1.py --all
  python scripts/staging_runbook_c1.py --apply-sql
  python scripts/staging_runbook_c1.py --promote
  python scripts/staging_runbook_c1.py --seed
  python scripts/staging_runbook_c1.py --jurist-pack
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
PROJECT_REF = "mwvogydwkxjngngqlqgx"
REVIEWER_EMAIL = os.environ.get("JURISLEX_REVIEWER_EMAIL", "fotso.mbarga@juriscm.cm")


def load_env() -> None:
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


def rest(method: str, path: str, body: dict | None = None, prefer: str | None = None) -> tuple[int, object]:
    url = (os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]).rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(f"{url}/rest/v1/{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8", errors="replace")
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw else raw
        except Exception:
            parsed = raw
        return e.code, parsed


def sql_file(path: Path) -> int:
    cmd = [
        "npx",
        "supabase",
        "db",
        "query",
        "--linked",
        "-f",
        str(path),
    ]
    print("[sql]", " ".join(cmd))
    # shell=True for Windows npx
    proc = subprocess.run(cmd, cwd=str(RACINE), shell=(os.name == "nt"))
    return proc.returncode


def sql_inline(query: str) -> int:
    cmd = ["npx", "supabase", "db", "query", "--linked", query]
    print("[sql]", query[:120].replace("\n", " "), "…")
    proc = subprocess.run(cmd, cwd=str(RACINE), shell=(os.name == "nt"))
    return proc.returncode


def step_apply_sql() -> bool:
    sql_path = RACINE / "supabase" / "migrations" / "004_c1_staging_jurislex_adapt.sql"
    code = sql_file(sql_path)
    if code != 0:
        print("WARN: apply adapt SQL failed (code", code, ") — retry once")
        code = sql_file(sql_path)
    # 005 editorial if missing
    sql_file(RACINE / "supabase" / "migrations" / "005_c2_editorial_queue.sql")
    # probe
    for table in ("profiles", "legal_relations", "legal_document_versions"):
        st, body = rest("GET", f"{table}?select=*&limit=1")
        print(f"  probe {table}: {st}")
    return code == 0


def step_promote() -> bool:
    st, rows = rest("GET", f"user_profiles?email=eq.{REVIEWER_EMAIL}&select=id,email,role")
    if st != 200 or not rows:
        # try profiles
        st, rows = rest("GET", f"profiles?email=eq.{REVIEWER_EMAIL}&select=id,email,role")
    if st != 200 or not rows:
        print(f"ERREUR: utilisateur {REVIEWER_EMAIL} introuvable (HTTP {st})")
        return False
    user_id = rows[0]["id"]
    print(f"Promote {REVIEWER_EMAIL} ({user_id}) → reviewer")

    # RPC promote
    st, body = rest(
        "POST",
        "rpc/promote_user_role",
        {"p_user_id": user_id, "p_role": "reviewer"},
    )
    if st in (200, 204):
        print("  RPC promote_user_role OK")
    else:
        print("  RPC failed", st, body, "— PATCH direct")
        rest(
            "PATCH",
            f"user_profiles?id=eq.{user_id}",
            {"role": "lawyer"},
            prefer="return=representation",
        )
        rest(
            "PATCH",
            f"profiles?id=eq.{user_id}",
            {"role": "reviewer"},
            prefer="return=representation",
        )

    st, rows = rest("GET", f"user_profiles?id=eq.{user_id}&select=id,email,role")
    print("  user_profiles:", rows)
    st, rows = rest("GET", f"profiles?id=eq.{user_id}&select=id,email,role")
    print("  profiles:", rows)
    return True


def step_seed() -> bool:
    seed = RACINE / "supabase" / "snippets" / "seed_c1_pilot_relations.sql"
    # Prefer adapted seed via REST if legal_relations exists
    st, _ = rest("GET", "legal_relations?select=id&limit=1")
    if st == 404:
        print("legal_relations absent — re-appliquer le SQL adapt d'abord")
        return False

    st, docs = rest(
        "GET",
        "legal_documents?select=id,slug,titre,categorie&or=(slug.ilike.*92-007*,slug.ilike.*constitution*,titre.ilike.*travail*,categorie.ilike.*OHADA*)&limit=50",
    )
    if st != 200:
        print("docs fetch", st, docs)
        return False
    print(f"  documents candidats: {len(docs) if isinstance(docs, list) else docs}")

    # CLI seed for full SQL
    code = sql_file(seed)

    # REST seed minimal if we have at least 2 docs
    if isinstance(docs, list) and len(docs) >= 2:
        pairs = []
        travail = [d for d in docs if "92-007" in (d.get("slug") or "") or "travail" in (d.get("titre") or "").lower()]
        ohada = [d for d in docs if "ohada" in (d.get("categorie") or "").lower() or "ohada" in (d.get("slug") or "").lower()]
        if travail and ohada:
            pairs.append((travail[0], ohada[0], "refers_to", "Pilote C1 REST: travail → OHADA (probable)"))
        if len(docs) >= 2:
            pairs.append((docs[0], docs[1], "cites", "Pilote C1 REST: citation structurelle (probable)"))

        created = 0
        for a, b, rtype, just in pairs:
            if a["id"] == b["id"]:
                continue
            st, body = rest(
                "POST",
                "legal_relations",
                {
                    "from_document_id": a["id"],
                    "to_document_id": b["id"],
                    "relation_type": rtype,
                    "confidence": "probable",
                    "justification": just,
                },
                prefer="return=representation,resolution=ignore-duplicates",
            )
            print(f"  relation {rtype}: HTTP {st}")
            if st in (200, 201):
                created += 1
        print(f"  relations créées (REST): {created}")

    st, rels = rest(
        "GET",
        "legal_relations?select=id,relation_type,confidence,justification&order=created_at.desc&limit=10",
    )
    print("  sample relations:", rels if st == 200 else (st, rels))
    return code == 0 or st == 200


def step_jurist_pack() -> Path:
    """Dossier validation 2–3 formules candidates verified pour un juriste."""
    pack = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": PROJECT_REF,
        "purpose": "Validation humaine des formules rules.ts avant statut verified en prod",
        "instructions": [
            "Pour chaque formule, cocher CONFORME / NON CONFORME / PARTIEL.",
            "Indiquer l'article exact du corpus et toute nuance (arrêté, convention, jurisprudence).",
            "Ne pas marquer verified si le barème monétaire dépend d'un texte non indexé.",
        ],
        "candidates": [
            {
                "id": "prescription-salaire-indemnites-3ans",
                "label": "Prescription action salaire & indemnités de rupture",
                "engine_status": "verified (code)",
                "proposed_formula": "date_exigibilité + 3 ans",
                "corpus_anchor": {
                    "text": "Loi n° 92-007 Code du travail",
                    "article": "74",
                    "source_path": "18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf",
                    "excerpt_summary": "Action en paiement du salaire se prescrit par trois ans ; indemnités de rupture assimilées au salaire.",
                },
                "jurist_checks": [
                    "Le délai de 3 ans s'applique-t-il bien aux indemnités de licenciement ?",
                    "Point de départ : date d'exigibilité — cas particuliers (licenciement, rappel de salaire) ?",
                    "Interruptions (inspecteur du travail, citation) correctement exclues du moteur automatique ?",
                ],
                "decision": None,
                "jurist_name": None,
                "jurist_notes": None,
            },
            {
                "id": "indemnite-licenciement-conditions",
                "label": "Conditions d'ouverture indemnité de licenciement",
                "engine_status": "verified (code) — montant séparé hypothesis",
                "proposed_formula": "CDI + initiative employeur + hors faute lourde + ancienneté continue ≥ 2 ans",
                "corpus_anchor": {
                    "text": "Loi n° 92-007",
                    "article": "37",
                    "source_path": "18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf",
                    "excerpt_summary": "Droit à indemnité distincte du préavis si rupture CDI employeur hors faute lourde et ≥ 2 ans ; modalités par arrêté.",
                },
                "jurist_checks": [
                    "Les 4 conditions sont-elles exhaustives pour le principe d'ouverture ?",
                    "Confirmer que le montant ne doit PAS être codifié sans l'arrêté ministériel.",
                    "Cas de licenciement économique (Art. 40+) : impact sur l'indemnité ?",
                ],
                "decision": None,
                "jurist_name": None,
                "jurist_notes": None,
            },
            {
                "id": "ohada-opposition-injonction-10j",
                "label": "Délai d'opposition à l'injonction de payer OHADA",
                "engine_status": "verified (code)",
                "proposed_formula": "date_signification + 10 jours (+ délais de distance non auto)",
                "corpus_anchor": {
                    "text": "AUPSRVE 2023",
                    "article": "9–10",
                    "source_path": "ohada/AUPSRVE-2023_fr.md",
                    "excerpt_summary": "Opposition = recours ordinaire ; formée dans les 10 jours de la signification.",
                },
                "jurist_checks": [
                    "Le délai de 10 jours est-il franc ou calendaire selon la pratique CCJA ?",
                    "Signification non personnelle (Art. 10 al. 2) : faut-il un second calcul dans le moteur ?",
                    "Interaction avec délais de distance : laisser en note manuelle est-il acceptable ?",
                ],
                "decision": None,
                "jurist_name": None,
                "jurist_notes": None,
            },
        ],
        "signature_block": {
            "jurist_full_name": "",
            "barreau": "",
            "date": "",
            "signature": "",
        },
    }
    out = RACINE / "build" / "jurist_validation_pack_c2a.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

    md = RACINE / "docs" / "VALIDATION_JURISTE_C2A.md"
    lines = [
        "# Validation juriste — formules C2a (candidats verified)",
        "",
        f"Généré : {pack['generated_at']}",
        "",
        "Merci de valider **2 à 3 formules** ci-dessous avant promotion définitive en production.",
        "",
    ]
    for i, c in enumerate(pack["candidates"], 1):
        lines += [
            f"## {i}. `{c['id']}`",
            "",
            f"**Libellé :** {c['label']}",
            f"**Formule moteur :** `{c['proposed_formula']}`",
            f"**Ancrage :** {c['corpus_anchor']['text']} — Art. {c['corpus_anchor']['article']}",
            f"**Source :** `{c['corpus_anchor']['source_path']}`",
            "",
            c["corpus_anchor"]["excerpt_summary"],
            "",
            "### Points à contrôler",
            "",
        ]
        for q in c["jurist_checks"]:
            lines.append(f"- [ ] {q}")
        lines += [
            "",
            "**Décision :** ☐ CONFORME · ☐ PARTIEL · ☐ NON CONFORME",
            "",
            "**Notes :**",
            "",
            "_______________________________________________",
            "",
        ]
    lines += [
        "---",
        "",
        f"**Juriste :** __________________  **Barreau :** ________  **Date :** ________",
        "",
        f"Fichier machine : `{out.relative_to(RACINE)}`",
    ]
    md.write_text("\n".join(lines), encoding="utf-8")
    print(f"  pack JSON: {out}")
    print(f"  pack MD:   {md}")
    return md


def step_env() -> None:
    env_path = RACINE / ".env.local"
    text = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    updates = {
        "JURISLEX_AUTH_BACKEND": "supabase",
        "JURISLEX_SESSION_SECRET": os.environ.get(
            "JURISLEX_SESSION_SECRET", "jurislex-staging-session-secret-c1-32chars"
        ),
        "NEXT_PUBLIC_DEMO_MODE": "false",
    }
    lines = text.splitlines() if text else []
    keys_seen = set()
    out_lines = []
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            k = line.split("=", 1)[0].strip()
            if k in updates:
                out_lines.append(f"{k}={updates[k]}")
                keys_seen.add(k)
                continue
        out_lines.append(line)
    for k, v in updates.items():
        if k not in keys_seen:
            out_lines.append(f"{k}={v}")
    env_path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    print("  .env.local → JURISLEX_AUTH_BACKEND=supabase (+ session secret)")


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--apply-sql", action="store_true")
    parser.add_argument("--promote", action="store_true")
    parser.add_argument("--seed", action="store_true")
    parser.add_argument("--jurist-pack", action="store_true")
    parser.add_argument("--env", action="store_true")
    args = parser.parse_args()
    if not any([args.all, args.apply_sql, args.promote, args.seed, args.jurist_pack, args.env]):
        args.all = True

    ok = True
    if args.all or args.env:
        print("=== 2. ENV auth supabase ===")
        step_env()
    if args.all or args.apply_sql:
        print("=== 1. Apply SQL adapt 004 (+005) ===")
        if not step_apply_sql():
            ok = False
    if args.all or args.promote:
        print("=== 3. Promote reviewer ===")
        if not step_promote():
            ok = False
    if args.all or args.seed:
        print("=== 4. Seed relations ===")
        if not step_seed():
            ok = False
    if args.all or args.jurist_pack:
        print("=== 5. Jurist validation pack (2–3 formules) ===")
        step_jurist_pack()

    print("DONE", "OK" if ok else "PARTIAL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
