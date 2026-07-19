"""run.py — launch the whole clinic application with one command.

Starts, as child processes:
  1. web         — FastAPI (tool API + dashboard UI + Cliniko/Supabase) via uvicorn
  2. pms_worker  — Cliniko write-back retry worker
  3. outbound_worker — outbound call retry/continuation worker
  4. keep_warm_worker — optional health pinger for hosted demos

The web server also serves the built React dashboard (from ../frontend/dist) at http://localhost:<port>/,
if it's been built — the dashboard can also be deployed separately (e.g. Vercel) pointed at this
backend's URL, in which case this fallback is simply unused.

Usage (run from inside backend/):
    cd backend
    python run.py                # port 8080
    python run.py --port 9000
"""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import functools

try:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
except Exception:
    pass
print = functools.partial(print, flush=True)  # unbuffered banner even when redirected

ROOT = Path(__file__).resolve().parent   # backend/ — subprocess cwd (so .env / app.* modules resolve)
REPO_ROOT = ROOT.parent                   # repo root — backend/ and frontend/ are siblings
PY = sys.executable

# Each entry: [name, args, Popen, is_critical]. Critical ("web") exiting brings down the whole
# stack; a background worker exiting just gets restarted with a backoff — a transient blip (e.g. a
# dropped DB connection) in one worker must never take down the live web server serving real calls.
PROCS: list[list] = []
RESTART_BACKOFF_SECONDS = 5


def start(name: str, args: list[str], critical: bool = False):
    print(f"  > starting {name}: {' '.join(args)}")
    p = subprocess.Popen(args, cwd=str(ROOT))
    PROCS.append([name, args, p, critical])


def shutdown(*_):
    print("\nShutting down...")
    for entry in PROCS:
        p = entry[2]
        if p.poll() is None:
            p.terminate()
    t0 = time.time()
    for entry in PROCS:
        p = entry[2]
        try:
            p.wait(timeout=max(0, 5 - (time.time() - t0)))
        except subprocess.TimeoutExpired:
            p.kill()
    print("Stopped.")
    sys.exit(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default=os.getenv("PORT", "8080"))
    ap.add_argument("--no-workers", action="store_true", help="run only the web server")
    args = ap.parse_args()

    dist = REPO_ROOT / "frontend" / "dist" / "index.html"
    ui = "React dashboard" if dist.exists() else "HTML fallback (run `npm run build` in ../frontend for the full UI)"

    print("=" * 60)
    print("  Aarogya Clinic - Voice Receptionist")
    print("=" * 60)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    start("web", [PY, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", args.port], critical=True)
    if not args.no_workers:
        start("pms_worker", [PY, "-m", "app.pms_writeback", "--loop", "10"])
        start("outbound_worker", [PY, "-m", "app.outbound_worker", "--loop", "30"])
        start("cliniko_sync_worker", [PY, "-m", "app.cliniko_sync", "--loop", "60"])
        if os.getenv("KEEP_WARM_URL") or os.getenv("BASE_URL"):
            start("keep_warm_worker", [PY, "-m", "app.keep_warm", "--loop", os.getenv("KEEP_WARM_INTERVAL_SECONDS", "300")])

    time.sleep(2)
    print("-" * 60)
    print(f"  Dashboard : http://localhost:{args.port}/   ({ui})")
    print(f"  Tool API  : http://localhost:{args.port}/tools/*")
    print(f"  Health    : http://localhost:{args.port}/health")
    print("  Ctrl+C to stop everything.")
    print("-" * 60)

    # supervise: "web" exiting brings down the whole stack (it's the primary process); a background
    # worker exiting gets logged and restarted after a short backoff instead — one worker's crash
    # (e.g. a transient DB connection blip) must never take down the live web server.
    while True:
        for entry in PROCS:
            name, cmd, p, critical = entry
            code = p.poll()
            if code is None:
                continue
            print(f"[!] {name} exited (code {code}).")
            if critical:
                shutdown()
            else:
                print(f"    restarting {name} in {RESTART_BACKOFF_SECONDS}s...")
                time.sleep(RESTART_BACKOFF_SECONDS)
                entry[2] = subprocess.Popen(cmd, cwd=str(ROOT))
        time.sleep(1)


if __name__ == "__main__":
    main()
