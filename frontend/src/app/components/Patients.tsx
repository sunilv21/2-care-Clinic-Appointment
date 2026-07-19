import { getPatients } from "../api";
import { Panel, DataTable, useLoad, StateBlock } from "./clinic-ui";

export function Patients() {
  const { data, loading, error } = useLoad(getPatients);
  return (
    <Panel title="🧑 Patients">
      <StateBlock loading={loading} error={error} />
      {data && (
        <DataTable cols={["Name", "Phone(s)", "Appointments", "In Cliniko"]} rows={data.rows}
          empty="No patients yet (seed with --with-patients)."
          render={(r) => [r.full_name, r.phones || "—", r.appt_count, r.cliniko_patient_id ? "✓" : "—"]} />
      )}
    </Panel>
  );
}
