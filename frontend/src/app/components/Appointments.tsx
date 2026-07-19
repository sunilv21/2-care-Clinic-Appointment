import { getAppointments } from "../api";
import { Panel, DataTable, Pill, fmt, useLoad, StateBlock } from "./clinic-ui";

export function Appointments() {
  const { data, loading, error } = useLoad(getAppointments);
  return (
    <Panel title="📅 Appointments">
      <StateBlock loading={loading} error={error} />
      {data && (
        <DataTable cols={["Patient", "Doctor", "Branch", "Type", "Start", "Status", "PMS sync", "Source"]} rows={data.rows}
          render={(r) => [r.patient, r.doctor, r.branch, r.appt_type, fmt(r.start_ts),
            <Pill value={r.status} />, <Pill value={r.pms_sync_state} />,
            r.origin === "cliniko_manual"
              ? <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">Cliniko</span>
              : <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">Agent</span>]} />
      )}
    </Panel>
  );
}
