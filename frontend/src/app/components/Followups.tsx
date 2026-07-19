import { useState } from "react";
import { getFollowups, resolveFollowup } from "../api";
import { Panel, DataTable, fmt, useLoad, StateBlock } from "./clinic-ui";

export function Followups() {
  const { data, loading, error } = useLoad(getFollowups);
  const [rows, setRows] = useState<any[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown = rows ?? data?.rows ?? [];

  const resolve = async (id: string) => {
    setBusyId(id);
    try {
      await resolveFollowup(id);
      setRows((await getFollowups()).rows);
    } catch (e: any) {
      alert("Resolve failed: " + e.message);
    } finally { setBusyId(null); }
  };

  return (
    <Panel title="🔔 Follow-ups (human handoff / clinical / unreachable)">
      <StateBlock loading={loading && !rows} error={error} />
      {(rows || data) && (
        <DataTable cols={["Phone", "Reason", "Notes", "Status", "Created", ""]} rows={shown}
          empty="No follow-ups logged."
          render={(r) => [
            r.phone_e164 || "—", r.reason, (r.notes || "").slice(0, 70),
            r.resolved
              ? <span className="text-xs px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">resolved</span>
              : <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">open</span>,
            fmt(r.created_at),
            r.resolved ? null : (
              <button onClick={() => resolve(r.id)} disabled={busyId === r.id}
                className="text-emerald-700 text-sm font-medium hover:underline disabled:opacity-50">
                {busyId === r.id ? "…" : "Mark resolved"}
              </button>
            ),
          ]} />
      )}
    </Panel>
  );
}
