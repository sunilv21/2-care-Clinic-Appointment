"""app/db.py — Postgres access for the clinic backend (Supabase, via Session pooler).

Thin layer over psycopg2 with a lazily-created ThreadedConnectionPool. Rows come back as dicts.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env", override=True)  # .env is authoritative over stale OS env vars

_POOL: Optional[ThreadedConnectionPool] = None


def _pool() -> ThreadedConnectionPool:
    global _POOL
    if _POOL is None:
        dsn = os.getenv("DATABASE_URL")
        if not dsn:
            raise RuntimeError("DATABASE_URL not set")
        _POOL = ThreadedConnectionPool(minconn=1, maxconn=8, dsn=dsn)
    return _POOL


@contextmanager
def get_conn():
    pool = _pool()
    conn = pool.getconn()
    # A connection can be closed server-side (e.g. Supabase's pooler reaping an idle one) without
    # psycopg2 knowing until it's actually used — discard it proactively if we can tell, and mark it
    # for discarding (rather than returning to the pool) if a rollback on it fails, which is the
    # tell-tale sign the connection is actually dead, not just the query.
    if conn.closed:
        pool.putconn(conn, close=True)
        conn = pool.getconn()
    broken = False
    try:
        yield conn
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            broken = True  # rollback itself failed -> connection is dead, don't return it to the pool
        raise
    finally:
        pool.putconn(conn, close=broken)


def query(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


def query_one(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: tuple = ()) -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount
