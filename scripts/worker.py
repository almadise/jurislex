#!/usr/bin/env python3
"""
JurisLex C1 — worker d'ingestion asynchrone.

Consomme des jobs depuis Redis (liste JURISLEX_INGESTION_QUEUE) et/ou
le fichier build/ingestion-jobs.json (mode local / --once).

Jobs supportés :
  verify | ocr | extract | upload | quality | pipeline

Usage :
  python scripts/worker.py              # boucle Redis
  python scripts/worker.py --once       # un job local ou Redis puis exit
  python scripts/worker.py --poll-file  # poll fichier local (sans Redis)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
JOBS_FILE = Path(os.environ.get("JURISLEX_INGESTION_JOBS_PATH", RACINE / "build" / "ingestion-jobs.json"))
QUEUE = os.environ.get("JURISLEX_INGESTION_QUEUE", "jurislex:ingestion:jobs")
SCRIPTS = RACINE / "scripts"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def read_jobs_file() -> dict:
    if not JOBS_FILE.exists():
        return {"jobs": []}
    try:
        return json.loads(JOBS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"jobs": []}


def write_jobs_file(data: dict) -> None:
    JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    JOBS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def update_job(job_id: str, **patch) -> dict | None:
    data = read_jobs_file()
    for j in data.get("jobs", []):
        if j.get("id") == job_id:
            j.update(patch)
            write_jobs_file(data)
            return j
    return None


def get_job(job_id: str) -> dict | None:
    for j in read_jobs_file().get("jobs", []):
        if j.get("id") == job_id:
            return j
    return None


def run_script(name: str, extra_args: list[str] | None = None) -> dict:
    script = SCRIPTS / name
    cmd = [sys.executable, str(script)] + (extra_args or [])
    print(f"[worker] $ {' '.join(cmd)}")
    proc = subprocess.run(
        cmd,
        cwd=str(RACINE),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return {
        "cmd": cmd,
        "returncode": proc.returncode,
        "stdout": (proc.stdout or "")[-8000:],
        "stderr": (proc.stderr or "")[-4000:],
        "ok": proc.returncode == 0,
    }


def execute_job(job: dict) -> dict:
    job_type = job.get("jobType") or job.get("job_type")
    payload = job.get("payload") or {}
    steps_out = []

    def step(label: str, script: str, args: list[str] | None = None) -> None:
        update_job(job["id"], progress={"step": label, "at": now_iso()})
        r = run_script(script, args)
        steps_out.append({"step": label, **r})
        if not r["ok"]:
            raise RuntimeError(f"Étape {label} échouée (code {r['returncode']}): {r['stderr'] or r['stdout']}")

    if job_type == "verify":
        step("verify", "00_verifier_corpus.py")
    elif job_type == "ocr":
        args = []
        if payload.get("dryRun"):
            args.append("--dry-run")
        budget = payload.get("budgetSeconds")
        if budget:
            args.extend(["--budget", str(int(budget))])
        step("ocr", "01_ocr.py", args)
    elif job_type == "extract":
        step("extract", "02_extract.py")
    elif job_type == "upload":
        if payload.get("dryRun"):
            step("upload_estimate", "03_upload.py", ["--estimation"])
        else:
            step("upload", "03_upload.py")
    elif job_type == "quality":
        thr = payload.get("qualityThreshold")
        args = []
        if thr is not None:
            args.extend(["--threshold", str(thr)])
        step("quality", "quality_score.py", args)
    elif job_type == "pipeline":
        pipeline_steps = payload.get("steps") or ["verify", "ocr", "extract", "quality"]
        mapping = {
            "verify": ("00_verifier_corpus.py", []),
            "ocr": (
                "01_ocr.py",
                (["--budget", str(int(payload["budgetSeconds"]))] if payload.get("budgetSeconds") else [])
                + (["--dry-run"] if payload.get("dryRun") else []),
            ),
            "extract": ("02_extract.py", []),
            "quality": (
                "quality_score.py",
                (["--threshold", str(payload["qualityThreshold"])] if payload.get("qualityThreshold") is not None else []),
            ),
            "upload": (
                "03_upload.py",
                ["--estimation"] if payload.get("dryRun") else [],
            ),
        }
        for s in pipeline_steps:
            if s not in mapping:
                raise RuntimeError(f"Étape pipeline inconnue: {s}")
            script, args = mapping[s]
            step(s, script, args)
    else:
        raise RuntimeError(f"Type de job inconnu: {job_type}")

    # Attacher le résumé qualité si présent
    quality_path = RACINE / "build" / "rapport_qualite.json"
    quality = None
    if quality_path.exists() and job_type in ("quality", "pipeline", "extract"):
        try:
            quality = json.loads(quality_path.read_text(encoding="utf-8")).get("summary")
        except Exception:
            quality = None

    return {"steps": steps_out, "qualitySummary": quality}


def process_job_id(job_id: str) -> bool:
    job = get_job(job_id)
    if not job:
        print(f"[worker] job {job_id} introuvable dans {JOBS_FILE}")
        return False
    if job.get("status") in ("succeeded", "running"):
        # running : reprise possible ; succeeded : skip
        if job.get("status") == "succeeded":
            print(f"[worker] job {job_id} déjà succeeded")
            return True

    update_job(
        job_id,
        status="running",
        startedAt=now_iso(),
        error=None,
        progress={"step": "start", "at": now_iso()},
    )
    try:
        job = get_job(job_id) or job
        result = execute_job(job)
        update_job(
            job_id,
            status="succeeded",
            finishedAt=now_iso(),
            result=result,
            progress={"step": "done", "at": now_iso()},
        )
        print(f"[worker] job {job_id} OK")
        return True
    except Exception as e:
        tb = traceback.format_exc()
        update_job(
            job_id,
            status="failed",
            finishedAt=now_iso(),
            error=str(e),
            result={"traceback": tb[-4000:]},
            progress={"step": "failed", "at": now_iso()},
        )
        print(f"[worker] job {job_id} FAILED: {e}")
        return False


def next_local_queued() -> str | None:
    jobs = read_jobs_file().get("jobs", [])
    queued = [j for j in jobs if j.get("status") == "queued"]
    queued.sort(key=lambda j: (j.get("priority", 100), j.get("createdAt") or ""))
    return queued[0]["id"] if queued else None


def redis_client():
    import redis  # type: ignore

    url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    return redis.from_url(url, decode_responses=True)


def loop_redis(once: bool) -> int:
    r = redis_client()
    print(f"[worker] écoute Redis {QUEUE} ({os.environ.get('REDIS_URL', 'redis://localhost:6379/0')})")
    while True:
        item = r.brpop(QUEUE, timeout=5)
        if item:
            _key, raw = item
            try:
                msg = json.loads(raw)
                job_id = msg.get("id") or msg
            except Exception:
                job_id = raw
            if isinstance(job_id, str):
                process_job_id(job_id)
            if once:
                return 0
        elif once:
            # fallback fichier
            jid = next_local_queued()
            if jid:
                process_job_id(jid)
            return 0


def loop_file(once: bool) -> int:
    print(f"[worker] poll fichier {JOBS_FILE}")
    while True:
        jid = next_local_queued()
        if jid:
            process_job_id(jid)
            if once:
                return 0
        else:
            if once:
                print("[worker] aucun job queued")
                return 0
            time.sleep(2)


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Worker ingestion JurisLex C1")
    parser.add_argument("--once", action="store_true", help="Traite un job puis quitte")
    parser.add_argument("--poll-file", action="store_true", help="Ignore Redis, poll le JSON local")
    parser.add_argument("--job-id", type=str, help="Traite un job précis")
    args = parser.parse_args()

    if args.job_id:
        return 0 if process_job_id(args.job_id) else 1

    if args.poll_file or not os.environ.get("REDIS_URL"):
        if not os.environ.get("REDIS_URL") and not args.poll_file:
            print("[worker] REDIS_URL absent — mode fichier local")
        return loop_file(once=args.once)

    try:
        return loop_redis(once=args.once)
    except Exception as e:
        print(f"[worker] Redis indisponible ({e}) — bascule fichier")
        return loop_file(once=args.once)


if __name__ == "__main__":
    raise SystemExit(main())
