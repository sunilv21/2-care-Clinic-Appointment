import { useState } from "react";
import { getInboundCalls, getInboundDetail, enqueueOutbound } from "../api";
import { Panel, DataTable, Pill, fmt, useLoad, StateBlock, Card } from "./clinic-ui";
import { PhoneIncoming, X, PhoneCall } from "lucide-react";

function TranscriptView({ transcript }: { transcript: any }) {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return <div className="text-sm text-gray-400">No transcript captured for this call.</div>;
  }
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {transcript.map((t: any, i: number) => {
        const role = String(t.role || t.speaker || "").toLowerCase();
        const mine = role === "agent" || role === "assistant" || role === "bot";
        return (
          <div key={i} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
              mine ? "bg-emerald-50 text-emerald-900" : "bg-gray-100 text-gray-800"
            }`}>
              <div className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5">{role || "caller"}</div>
              {t.text || t.content || t.message || JSON.stringify(t)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CallDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, loading, error } = useLoad(() => getInboundDetail(id), [id]);
  const [busy, setBusy] = useState(false);

  const scheduleCallback = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await enqueueOutbound(data.phone_e164, "continue", data.id);
      alert("Callback scheduled — the outbound worker will retry and resume this call's context.");
      onChanged();
    } catch (e: any) {
      alert("Failed: " + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20 p-4" onClick={onClose}>
      <Card className="p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto" >
        <div onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Call detail</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="size-5" /></button>
          </div>
          <StateBlock loading={loading} error={error} />
          {data && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div><span className="text-gray-500">Phone</span><div className="font-medium">{data.phone_e164}</div></div>
                <div><span className="text-gray-500">Patient</span><div className="font-medium">{data.patient_name || "Unknown"}</div></div>
                <div><span className="text-gray-500">State</span><div><Pill value={data.state} /></div></div>
                <div><span className="text-gray-500">Ended status</span><div>{data.ended_status || "—"}</div></div>
                <div><span className="text-gray-500">Turns</span><div>{data.turns ?? "—"}</div></div>
                <div><span className="text-gray-500">Updated</span><div>{fmt(data.updated_at)}</div></div>
              </div>

              {data.context_json && Object.keys(data.context_json).length > 0 && (
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Booking context (resume point)</div>
                  <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto">{JSON.stringify(data.context_json, null, 2)}</pre>
                </div>
              )}

              <div className="mb-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Transcript</div>
                <TranscriptView transcript={data.transcript_json} />
              </div>

              {data.linked_appointments?.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">This patient's appointments</div>
                  <ul className="text-sm space-y-1">
                    {data.linked_appointments.map((a: any) => (
                      <li key={a.id}>{fmt(a.start_ts)} — {a.doctor} @ {a.branch} <Pill value={a.status} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {(data.state === "interrupted" || data.state === "callback_pending") && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-sm text-orange-700 mb-2">
                    This call {data.state === "interrupted" ? "dropped" : "was never reached"} — it hasn't been resumed.
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={scheduleCallback} disabled={busy}
                      className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60">
                      <PhoneCall className="size-4" /> Schedule callback to continue
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export function InboundCalls() {
  const { data, loading, error } = useLoad(getInboundCalls);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, force] = useState(0);

  return (
    <Panel title="📥 Inbound Calls">
      <StateBlock loading={loading} error={error} />
      {data && (
        <DataTable cols={["", "Phone", "Patient", "State", "Ended", "Updated", ""]} rows={data.rows}
          empty="No inbound calls yet — once patients call in, they'll show up here with full transcripts."
          render={(r) => [
            r.needs_attention ? <PhoneIncoming className="size-4 text-orange-500" /> : <PhoneIncoming className="size-4 text-gray-300" />,
            r.phone_e164, r.patient_name || <span className="text-gray-400">Unknown</span>,
            <Pill value={r.state} />, r.ended_status || "—", fmt(r.updated_at),
            <button onClick={() => setOpenId(r.id)} className="text-emerald-700 text-sm font-medium hover:underline">View</button>,
          ]} />
      )}
      {openId && (
        <CallDetail id={openId} onClose={() => setOpenId(null)} onChanged={() => force(n => n + 1)} />
      )}
    </Panel>
  );
}
