"""app/keep_warm.py - periodically ping the deployed backend health endpoint.

Run:
    python -m app.keep_warm --loop 300

Configure:
    KEEP_WARM_URL=https://your-render-service.onrender.com
    KEEP_WARM_PATH=/health
"""

from __future__ import annotations

import argparse
import os
import time
from urllib.parse import urljoin

import httpx
from dotenv import load_dotenv


load_dotenv(dotenv_path=".env", override=True)


def _target_url() -> str:
    base = (os.getenv("KEEP_WARM_URL") or os.getenv("BASE_URL") or "").strip()
    if not base:
        return ""
    path = os.getenv("KEEP_WARM_PATH", "/health").strip() or "/health"
    return urljoin(base.rstrip("/") + "/", path.lstrip("/"))


def ping_once(url: str) -> bool:
    started = time.time()
    try:
        with httpx.Client(timeout=20, follow_redirects=True) as client:
            res = client.get(url)
        elapsed_ms = int((time.time() - started) * 1000)
        ok = 200 <= res.status_code < 500
        status = "ok" if ok else "failed"
        print(f"[keep_warm] {status} {res.status_code} {elapsed_ms}ms {url}", flush=True)
        return ok
    except Exception as exc:
        elapsed_ms = int((time.time() - started) * 1000)
        print(f"[keep_warm] error {elapsed_ms}ms {url}: {exc}", flush=True)
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", type=int, default=int(os.getenv("KEEP_WARM_INTERVAL_SECONDS", "300")))
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()

    url = _target_url()
    if not url:
        raise SystemExit("Set KEEP_WARM_URL or BASE_URL to enable the keep-warm worker.")

    print(f"keep-warm worker: pinging {url} every {args.loop}s", flush=True)
    while True:
        ping_once(url)
        if args.once:
            return
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
