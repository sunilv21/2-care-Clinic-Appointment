import { getClinic } from "../api";
import { Panel, DataTable, useLoad, StateBlock } from "./clinic-ui";

export function ClinicSetup() {
  const { data, loading, error } = useLoad(getClinic);
  return (
    <div>
      <Panel title="🏢 Branches">
        <StateBlock loading={loading} error={error} />
        {data && (
          <DataTable cols={["Branch", "Address", "Buffer", "Hours", "Cliniko"]} rows={data.branches}
            render={(b) => [b.name, b.address || "—", `${b.buffer_minutes} min`,
              `${b.open_time}–${b.close_time}`, b.cliniko_business_id ? "✓ linked" : "—"]} />
        )}
      </Panel>
      <Panel title="🩺 Doctors">
        {data && (
          <DataTable cols={["Doctor", "Specialty", "Cliniko link"]} rows={data.doctors}
            render={(d) => [d.display_name, d.specialty, d.cliniko_practitioner_id ? "✓ linked" : "—"]} />
        )}
      </Panel>
      <Panel title="🗂️ Appointment types">
        {data && (
          <DataTable cols={["Type", "Duration"]} rows={data.appointment_types}
            render={(a) => [a.name, `${a.duration_min} min`]} />
        )}
      </Panel>
    </div>
  );
}
