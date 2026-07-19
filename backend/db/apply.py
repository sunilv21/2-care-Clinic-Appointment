"""db/apply.py — apply SQL migrations in db/migrations/ (sorted) to a Postgres DB.

Target DB is taken from --dsn or the DATABASE_URL env var. Works against a local Docker
Postgres (for validation) or a Supabase connection string (for the real DB) — identical SQL.

Usage:
    DATABASE_URL=postgres://... python -m db.apply
    python -m db.apply --dsn postgres://postgres:pw@localhost:5433/postgres
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg2

MIG_DIR = Path(__file__).resolve().parent / "migrations"


def apply(dsn: str) -> None:
    files = sorted(MIG_DIR.glob("*.sql"))
    if not files:
        print("no migrations found")
        return
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            for f in files:
                sql = f.read_text(encoding="utf-8")
                print(f"applying {f.name} ...")
                cur.execute(sql)
        conn.commit()
        print(f"OK — applied {len(files)} migration(s)")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.getenv("DATABASE_URL", ""))
    args = ap.parse_args()
    if not args.dsn:
        print("ERROR: pass --dsn or set DATABASE_URL", file=sys.stderr)
        sys.exit(2)
    apply(args.dsn)


if __name__ == "__main__":
    main()
