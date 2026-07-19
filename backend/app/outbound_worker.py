"""app/outbound_worker.py — place due outbound calls on an interval.

Run:  python -m app.outbound_worker --loop 30
"""

from __future__ import annotations

import argparse
import time

from app.outbound import process_due


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", type=int, default=0, help="poll interval seconds (0 = run once)")
    args = ap.parse_args()
    if args.loop:
        print(f"outbound worker: polling every {args.loop}s")
        while True:
            try:
                res = process_due()
                if res["placed"]:
                    print("placed:", res)
            except Exception as e:
                print(f"[outbound_worker] cycle failed, will retry next poll: {e}")
            time.sleep(args.loop)
    else:
        print(process_due())


if __name__ == "__main__":
    main()
