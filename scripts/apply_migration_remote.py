#!/usr/bin/env python3
"""
Applique un fichier SQL sur Supabase via l'API Management (nécessite access token)
ou via PostgREST impossible pour DDL.

Fallback privilégié : variables SUPABASE_DB_URL / DATABASE_URL (postgres://).
Sinon : SUPABASE_ACCESS_TOKEN + project ref pour l'endpoint query.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent


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


def apply_via_pg(sql: str, dsn: str) -> None:
    try:
        import psycopg2  # type: ignore
    except ImportError:
        # try psycopg
        try:
            import psycopg as psycopg2  # type: ignore
        except ImportError as e:
            raise SystemExit(
                "Installer psycopg2-binary ou psycopg pour DATABASE_URL : pip install psycopg2-binary"
            ) from e

    print(f"[pg] connexion…")
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        print("[pg] OK")
    finally:
        conn.close()


def apply_via_management_api(sql: str, project_ref: str, access_token: str) -> None:
    """POST /v1/projects/{ref}/database/query (Supabase Management API)."""
    url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"
    body = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode("utf-8", errors="replace")
            print(f"[mgmt] HTTP {r.status}")
            print(raw[:2000] if raw else "(empty)")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"[mgmt] HTTP {e.code}: {err}") from e


def rest_probe(table: str) -> tuple[int, str]:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return 0, "no url/key"
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{table}?select=*&limit=1",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", errors="replace")[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")[:300]
    except Exception as e:
        return 0, str(e)


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("sql_file", type=Path, nargs="?", help="Fichier SQL à appliquer")
    parser.add_argument("--probe", action="store_true", help="Sonde les tables clés")
    parser.add_argument("--project-ref", default=os.environ.get("SUPABASE_PROJECT_REF", "mwvogydwkxjngngqlqgx"))
    args = parser.parse_args()

    if args.probe or not args.sql_file:
        for t in (
            "legal_documents",
            "profiles",
            "legal_relations",
            "legal_document_versions",
            "ingestion_jobs",
            "editorial_queue",
        ):
            code, body = rest_probe(t)
            print(f"probe {t}: {code} {body[:120]}")
        if not args.sql_file:
            return 0

    sql_path = args.sql_file
    if not sql_path.is_absolute():
        sql_path = (RACINE / sql_path).resolve()
    if not sql_path.exists():
        print(f"Fichier introuvable: {sql_path}")
        return 1
    sql = sql_path.read_text(encoding="utf-8")
    print(f"SQL {sql_path.name}: {len(sql)} chars")

    dsn = (
        os.environ.get("SUPABASE_DB_URL")
        or os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or ""
    )
    if dsn:
        apply_via_pg(sql, dsn)
        return 0

    token = (
        os.environ.get("SUPABASE_ACCESS_TOKEN")
        or os.environ.get("SUPABASE_MANAGEMENT_TOKEN")
        or ""
    )
    # CLI stores token sometimes
    if not token:
        home = Path.home()
        for p in (
            home / ".supabase" / "access-token",
            home / "AppData" / "Roaming" / "supabase" / "access-token",
        ):
            if p.exists():
                token = p.read_text(encoding="utf-8").strip()
                break

    if token:
        apply_via_management_api(sql, args.project_ref, token)
        return 0

    print(
        "Aucune méthode d'application SQL.\n"
        "Options:\n"
        "  1) Définir SUPABASE_DB_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres\n"
        "  2) Définir SUPABASE_ACCESS_TOKEN (Personal Access Token dashboard)\n"
        "  3) Coller le SQL dans Studio > SQL Editor\n"
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
