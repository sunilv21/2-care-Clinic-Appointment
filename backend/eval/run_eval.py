"""eval/run_eval.py — run the scripted scenarios through the real agent brain + backend and report
per-language metrics.

Metrics (per language, not blended):
- success rate            — booking completed (or follow-up logged for escalation)
- avg turns-to-completion — caller turns until a confirmed booking
- redundant questions     — times the agent asked for info already given (LLM judge)
- avg tool latency (ms)   — backend tool execution time (ASR/LLM/TTS not measurable offline — see README)
- tool-call correctness   — did it run find_availability live before booking

Re-runnable from a clean clone. All test bookings are cleaned up at the end.

Usage:  python -m eval.run_eval
"""

from __future__ import annotations

import json
import statistics
from collections import defaultdict
from typing import Any, Dict, List

from app import db
from eval.agent_loop import Conversation, make_client, MODEL
from eval.scenarios import SCENARIOS

TEST_PHONES = [s["phone"] for s in SCENARIOS]


def judge_redundant(client, transcript: List[Dict[str, str]]) -> int:
    """Ask the model to count questions asking for info the caller already provided."""
    convo = "\n".join(f"{t['role']}: {t['text']}" for t in transcript)
    try:
        r = client.chat.completions.create(
            model=MODEL, temperature=0,
            messages=[
                {"role": "system", "content":
                 "You audit a call transcript. Count how many times the AGENT asked the caller for "
                 "information the caller had ALREADY clearly provided earlier in the same call "
                 "(e.g. name, branch, specialty, time). Reply with ONLY an integer."},
                {"role": "user", "content": convo},
            ], max_tokens=10)
        txt = (r.choices[0].message.content or "0").strip()
        return int("".join(ch for ch in txt if ch.isdigit()) or "0")
    except Exception:
        return -1  # judge unavailable


def run_scenario(sc: Dict[str, Any], client) -> Dict[str, Any]:
    conv = Conversation(sc["phone"], client=client)
    transcript: List[Dict[str, str]] = []
    turns_to_completion = None
    for i, utter in enumerate(sc["turns"], start=1):
        transcript.append({"role": "caller", "text": utter})
        reply = conv.user_turn(utter)
        transcript.append({"role": "agent", "text": reply})
        if conv.booked and turns_to_completion is None:
            turns_to_completion = i

    tool_names = [t["name"] for t in conv.tool_calls]
    latencies = [t["latency_ms"] for t in conv.tool_calls]
    followup = "log_followup" in tool_names
    # correctness: booking preceded by a live availability call
    booked_after_avail = ("find_availability" in tool_names and "book_appointment" in tool_names
                          and tool_names.index("find_availability") < tool_names.index("book_appointment")) \
        if "book_appointment" in tool_names else False

    success = (conv.booked if sc["expect_booking"] else followup)
    return {
        "id": sc["id"], "lang": sc["lang"], "success": success,
        "booked": conv.booked, "turns_to_completion": turns_to_completion,
        "followup_logged": followup, "tool_calls": tool_names,
        "avg_tool_latency_ms": round(statistics.mean(latencies), 1) if latencies else 0,
        "live_avail_before_book": booked_after_avail,
        "redundant_questions": judge_redundant(client, transcript),
        "transcript": transcript,
    }


def cleanup():
    with db.get_conn() as conn:
        cur = conn.cursor()
        ph = tuple(TEST_PHONES)
        cur.execute("""delete from pms_outbox where appointment_id in
                       (select a.id from appointments a join patient_phones pp on pp.patient_id=a.patient_id
                        where pp.phone_e164 in %s)""", (ph,))
        cur.execute("""delete from appointments where patient_id in
                       (select patient_id from patient_phones where phone_e164 in %s)""", (ph,))
        cur.execute("delete from call_sessions where phone_e164 in %s", (ph,))
        cur.execute("delete from followups where phone_e164 in %s or reason in ('asked_for_human','clinical_concern','out_of_scope')", (ph,))
        cur.execute("delete from patient_phones where phone_e164 in %s", (ph,))
        cur.execute("delete from patients where id not in (select patient_id from patient_phones)")


def main():
    client = make_client()
    print(f"Running {len(SCENARIOS)} scenarios on {MODEL} ...\n")
    results = []
    for sc in SCENARIOS:
        print(f"  · {sc['id']} ({sc['lang']}) ...", end="", flush=True)
        res = run_scenario(sc, client)
        results.append(res)
        print(f" success={res['success']} turns={res['turns_to_completion']} "
              f"redundant={res['redundant_questions']} tools={len(res['tool_calls'])}")

    # per-language aggregation
    by_lang: Dict[str, List[Dict]] = defaultdict(list)
    for r in results:
        by_lang[r["lang"]].append(r)

    print("\n" + "=" * 64)
    print("PER-LANGUAGE METRICS")
    print("=" * 64)
    for lang, rs in sorted(by_lang.items()):
        n = len(rs)
        succ = sum(1 for r in rs if r["success"])
        ttc = [r["turns_to_completion"] for r in rs if r["turns_to_completion"]]
        red = [r["redundant_questions"] for r in rs if r["redundant_questions"] >= 0]
        lat = [r["avg_tool_latency_ms"] for r in rs if r["avg_tool_latency_ms"]]
        print(f"\n[{lang}]  scenarios={n}")
        print(f"  success rate         : {succ}/{n}")
        print(f"  avg turns-to-book    : {round(statistics.mean(ttc),2) if ttc else '—'}")
        print(f"  redundant questions  : total {sum(red) if red else 0} (avg {round(statistics.mean(red),2) if red else '—'})")
        print(f"  avg tool latency (ms): {round(statistics.mean(lat),1) if lat else '—'}")

    # persist raw results
    out = "eval/last_run.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nRaw results -> {out}")

    cleanup()
    print("Cleanup done (all test bookings removed).")


if __name__ == "__main__":
    main()
