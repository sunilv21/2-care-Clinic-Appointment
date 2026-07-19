import { useState } from "react";
import { getOutbound, enqueueOutbound, processOutbound } from "../api";
import { Panel, DataTable, Pill, fmt, useLoad, StateBlock } from "./clinic-ui";
import { PhoneOutgoing, Play } from "lucide-react";

export function Outbound() {
  const { data, loading, error } = useLoad(getOutbound);
  const [rows, setRows] = useState<any[] | null>(null);
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("callback");
  const [busy, setBusy] = useState(false);

  const list = data?.rows || [];
  const shown = rows ?? list;

  const refresh = async () => setRows((await getOutbound()).rows);

  const enqueue = async () => {
    if (!phone.trim()) return alert("Enter a phone number");
    setBusy(true);
    try { await enqueueOutbound(phone.trim(), purpose); setPhone(""); await refresh(); }
    catch (e: any) { alert("Enqueue failed: " + e.message); }
    finally { setBusy(false); }
  };
  const process = async () => {
    setBusy(true);
    try { const r = await processOutbound(); alert("Process: " + JSON.stringify(r)); await refresh(); }
    catch (e: any) { alert("Process failed: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <Panel title="📞 Outbound calls — retry & continuation">
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40" placeholder="+9190…"
          value={phone} onChange={e => setPhone(e.target.value)} />
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={purpose} onChange={e => setPurpose(e.target.value)}>
          <option value="callback">callback</option>
          <option value="reminder">reminder</option>
          <option value="followup">followup</option>
        </select>
        <button onClick={enqueue} disabled={busy}
          className="inline-flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2 text-sm hover:border-blue-500 disabled:opacity-60">
          <PhoneOutgoing className="size-4" />Enqueue
        </button>
        <button onClick={process} disabled={busy}
          className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60">
          <Play className="size-4" />Process due
        </button>
      </div>
      <StateBlock loading={loading && !rows} error={error} />
      {(rows || data) && (
        <DataTable cols={["Phone", "Purpose", "Status", "Attempts", "Next attempt", "Last", "Updated"]} rows={shown}
          empty="No outbound calls."
          render={(r) => [r.phone_e164, r.purpose, <Pill value={r.status} />,
            `${r.attempts}/${r.max_attempts}`, fmt(r.next_attempt_at), r.last_status || "—", fmt(r.updated_at)]} />
      )}
    </Panel>
  );
}
