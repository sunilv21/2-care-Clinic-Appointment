import { useState } from "react";
import { getSummary, getClinic, getCliniko, getBolna, getAvailability } from "../api";
import { Stat, Panel, DataTable, useLoad, StateBlock } from "./clinic-ui";
import { Search } from "lucide-react";

export function Overview() {
  const summary = useLoad(getSummary);
  const clinic = useLoad(getClinic);
  const cliniko = useLoad(getCliniko);
  const bolna = useLoad(getBolna);

  const [spec, setSpec] = useState("");
  const [branch, setBranch] = useState("");
  const [slots, setSlots] = useState<any[] | null>(null);
  const [finding, setFinding] = useState(false);

  const find = async () => {
    setFinding(true);
    try { setSlots((await getAvailability({ specialty: spec, branch, limit: 8 })).slots); }
    finally { setFinding(false); }
  };

  const s = summary.data || {};
  const stats: [string, string, string][] = [
    ["appointments_booked", "Booked appts", ""],
    ["patients", "Patients", ""],
    ["doctors", "Doctors", ""],
    ["branches", "Branches", ""],
    ["outbound_pending", "Outbound pending", "text-amber-600"],
    ["followups_open", "Open follow-ups", "text-red-600"],
    ["sessions_open", "Open sessions", "text-amber-600"],
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        {stats.map(([k, l, tone]) => <Stat key={k} n={(s as any)[k] ?? "—"} label={l} tone={tone} />)}
      </div>

      <Panel title="🔎 Availability finder">
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={spec} onChange={e => setSpec(e.target.value)}>
            <option value="">Any specialty</option>
            {[...new Set((clinic.data?.doctors || []).map((d: any) => d.specialty))].map((sp: any) => <option key={sp}>{sp}</option>)}
          </select>
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={branch} onChange={e => setBranch(e.target.value)}>
            <option value="">Both branches</option>
            {(clinic.data?.branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={find} disabled={finding}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
            <Search className="size-4" />{finding ? "Searching…" : "Find earliest"}
          </button>
        </div>
        {slots && (
          <DataTable cols={["Date", "Time", "Doctor", "Specialty", "Branch"]} rows={slots}
            empty="No open slots for that filter."
            render={(r) => [r.local_date, r.local_time, r.practitioner_name, r.specialty, r.branch_name]} />
        )}
      </Panel>

      <Panel title="🔗 Cliniko connection">
        <StateBlock loading={cliniko.loading} error={cliniko.error} />
        {cliniko.data && (cliniko.data.ok
          ? <div className="text-sm text-gray-700">
              Connected · shard <b>{cliniko.data.shard}</b> · {cliniko.data.businesses.length} branches ·{" "}
              {cliniko.data.practitioners.length} practitioners · {cliniko.data.patients_total} patients ·{" "}
              {cliniko.data.appointments_total} appointments
            </div>
          : <div className="text-red-600 text-sm">Cliniko error: {cliniko.data.error}</div>)}
      </Panel>

      <Panel title="🎙️ Bolna connection">
        <StateBlock loading={bolna.loading} error={bolna.error} />
        {bolna.data && (bolna.data.ok ? (
          <div className="text-sm text-gray-700 space-y-2">
            <div>
              Connected · agent <b>{bolna.data.agent_name}</b> ({bolna.data.agent_status}) ·{" "}
              {bolna.data.phone_numbers.length > 0
                ? <>number <b>{bolna.data.phone_numbers.join(", ")}</b></>
                : <span className="text-amber-600">no phone number attached</span>}
            </div>
            <div className="text-xs text-gray-500">
              STT: {bolna.data.stt_provider || "—"} ({bolna.data.stt_language || "—"}) · TTS: {bolna.data.tts_provider || "—"}
              {bolna.data.llm_model ? ` · LLM: ${bolna.data.llm_model}` : ""}
            </div>
            {bolna.data.setup_complete ? (
              <div className="inline-block text-xs px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                Tools + end-of-call webhook configured — ready for live calls
              </div>
            ) : (
              <div className="inline-block text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                Setup incomplete — {!bolna.data.tools_configured && "tools not wired"}
                {!bolna.data.tools_configured && !bolna.data.webhook_configured && " · "}
                {!bolna.data.webhook_configured && "no end-of-call webhook"} (see bolna/SETUP.md)
              </div>
            )}
          </div>
        ) : <div className="text-red-600 text-sm">Bolna error: {bolna.data.error}</div>)}
      </Panel>
    </div>
  );
}
