import { getSessions } from "../api";
import { Panel, DataTable, Pill, fmt, useLoad, StateBlock } from "./clinic-ui";

export function Sessions() {
  const { data, loading, error } = useLoad(getSessions);
  return (
    <Panel title="☎️ Call sessions (drop / callback / resume state)">
      <StateBlock loading={loading} error={error} />
      {data && (
        <DataTable cols={["Phone", "Direction", "State", "Ended status", "Updated"]} rows={data.rows}
          empty="No call sessions yet."
          render={(r) => [r.phone_e164, r.direction, <Pill value={r.state} />, r.ended_status || "—", fmt(r.updated_at)]} />
      )}
    </Panel>
  );
}
