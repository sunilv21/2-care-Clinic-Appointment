/**
 * Hand-rolled SVG diagrams for the documentation pages.
 *
 * Deliberately dependency-free: these render as plain inline SVG so the docs
 * stay printable, themeable and free of a runtime diagram library. Coordinates
 * are authored against a fixed viewBox per diagram and scaled by the wrapper.
 */

const TONES = {
  external: { fill: "#3d4d6c", stroke: "#93a7c9" },
  voice: { fill: "#2d5f8b", stroke: "#8ec5ff" },
  backend: { fill: "#2f6f55", stroke: "#59d0a2" },
  data: { fill: "#1f3b5b", stroke: "#6ea8ff" },
  decision: { fill: "#8a5a1f", stroke: "#f0b566" },
  muted: { fill: "#f8fafc", stroke: "#cbd5e1" },
} as const;

type Tone = keyof typeof TONES;

const LINE = "#94a3b8";
const TEXT_ON_DARK = "#f3f7ff";
const TEXT_ON_LIGHT = "#334155";

function Defs() {
  return (
    <defs>
      <marker id="doc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={LINE} />
      </marker>
      <marker id="doc-arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke={LINE} strokeWidth="1.6" />
      </marker>
    </defs>
  );
}

function Frame({ viewBox, minWidth, label, children }: { viewBox: string; minWidth: number; label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <svg viewBox={viewBox} style={{ minWidth }} className="w-full h-auto" role="img" aria-label={label}>
        <Defs />
        {children}
      </svg>
    </div>
  );
}

function Node({
  x, y, w, h = 54, tone = "data", label, sub,
}: { x: number; y: number; w: number; h?: number; tone?: Tone; label: string; sub?: string }) {
  const { fill, stroke } = TONES[tone];
  const light = tone === "muted";
  const cx = x + w / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={cx} y={sub ? y + h / 2 - 2 : y + h / 2 + 5} textAnchor="middle" fill={light ? TEXT_ON_LIGHT : TEXT_ON_DARK} fontSize={14} fontWeight={600}>
        {label}
      </text>
      {sub && (
        <text x={cx} y={y + h / 2 + 15} textAnchor="middle" fill={light ? "#64748b" : "#c7d7f0"} fontSize={11}>
          {sub}
        </text>
      )}
    </g>
  );
}

function Diamond({ cx, cy, rx = 78, ry = 40, label }: { cx: number; cy: number; rx?: number; ry?: number; label: string }) {
  const { fill, stroke } = TONES.decision;
  return (
    <g>
      <polygon points={`${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}`} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={cx} y={cy + 4} textAnchor="middle" fill={TEXT_ON_DARK} fontSize={13} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

function Edge({ d, label, labelX, labelY, dashed, open }: { d: string; label?: string; labelX?: number; labelY?: number; dashed?: boolean; open?: boolean }) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={LINE}
        strokeWidth={2}
        strokeDasharray={dashed ? "6 5" : undefined}
        markerEnd={`url(#${open ? "doc-arrow-open" : "doc-arrow"})`}
      />
      {label && labelX !== undefined && labelY !== undefined && (
        <text x={labelX} y={labelY} textAnchor="middle" fill={TEXT_ON_LIGHT} fontSize={11} fontWeight={500}>
          <tspan className="doc-edge-label">{label}</tspan>
        </text>
      )}
    </g>
  );
}

function LaneLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text x={x} y={y} fill="#64748b" fontSize={11} fontWeight={700} letterSpacing="0.08em">
      {text.toUpperCase()}
    </text>
  );
}

function Lane({ y, h, label, viewWidth }: { y: number; h: number; label: string; viewWidth: number }) {
  return (
    <g>
      <rect x={0} y={y} width={viewWidth} height={h} fill="#f8fafc" stroke="#e2e8f0" />
      <LaneLabel x={12} y={y + 18} text={label} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* 1. System architecture — layered view                               */
/* ------------------------------------------------------------------ */

export function SystemArchitectureDiagram() {
  const W = 960;
  return (
    <Frame viewBox={`0 0 ${W} 560`} minWidth={760} label="Layered system architecture from caller through telephony, voice agent, backend and data stores">
      <Lane y={0} h={100} label="Callers & operators" viewWidth={W} />
      <Lane y={100} h={100} label="Telephony & voice" viewWidth={W} />
      <Lane y={200} h={160} label="Application — FastAPI" viewWidth={W} />
      <Lane y={360} h={100} label="Data — Supabase Postgres" viewWidth={W} />
      <Lane y={460} h={100} label="External systems" viewWidth={W} />

      {/* Callers & operators */}
      <Node x={170} y={26} w={160} tone="external" label="Patient caller" sub="inbound / outbound PSTN" />
      <Node x={620} y={26} w={180} tone="external" label="Clinic operator" sub="React dashboard" />

      {/* Telephony */}
      <Node x={170} y={126} w={160} tone="voice" label="Twilio" sub="verified numbers" />
      <Node x={390} y={126} w={180} tone="voice" label="Bolna agent" sub="ASR · LLM · TTS" />

      {/* Application */}
      <Node x={60} y={228} w={170} h={48} tone="backend" label="Tool endpoints" sub="/tools/* · X-Tool-Secret" />
      <Node x={60} y={292} w={170} h={48} tone="backend" label="Webhooks" sub="/webhooks/*" />
      <Node x={300} y={228} w={190} h={48} tone="backend" label="Availability engine" sub="derived, never cached" />
      <Node x={300} y={292} w={190} h={48} tone="backend" label="Outbound worker" sub="/outbound/process" />
      <Node x={560} y={228} w={190} h={48} tone="backend" label="Dashboard API" sub="/api/dashboard/*" />
      <Node x={560} y={292} w={190} h={48} tone="backend" label="PMS sync worker" sub="drains pms_outbox" />

      {/* Data */}
      <Node x={70} y={386} w={180} h={48} tone="data" label="Scheduling tables" sub="appointments · schedules" />
      <Node x={300} y={386} w={180} h={48} tone="data" label="Patient registry" sub="patients · patient_phones" />
      <Node x={530} y={386} w={180} h={48} tone="data" label="Call state" sub="call_sessions · followups" />
      <Node x={760} y={386} w={150} h={48} tone="data" label="pms_outbox" sub="retry queue" />

      {/* External */}
      <Node x={390} y={486} w={190} tone="external" label="Cliniko PMS" sub="system of record" />

      {/* Edges */}
      <Edge d="M 250 80 L 250 126" />
      <Edge d="M 330 152 L 390 152" label="media stream" labelX={360} labelY={144} />
      <Edge d="M 445 180 L 200 228" label="tool calls" labelX={330} labelY={200} />
      <Edge d="M 490 180 L 200 292" label="call-end webhook" labelX={420} labelY={224} dashed />
      <Edge d="M 700 80 L 660 228" label="REST" labelX={700} labelY={160} />

      <Edge d="M 145 340 L 145 386" open />
      <Edge d="M 395 276 L 390 386" open />
      <Edge d="M 655 276 L 620 386" open />
      <Edge d="M 700 340 L 820 386" open />
      <Edge d="M 655 340 L 500 486" label="write-back" labelX={620} labelY={430} />
      <Edge d="M 470 486 L 420 434" label="reconcile" labelX={400} labelY={470} dashed />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Call flowchart — with decision branches                          */
/* ------------------------------------------------------------------ */

export function CallFlowchartDiagram() {
  return (
    <Frame viewBox="0 0 980 720" minWidth={800} label="Call handling flowchart including identification, intent routing, booking and interruption recovery">
      <Node x={400} y={14} w={180} h={44} tone="voice" label="Call connected" />
      <Edge d="M 490 58 L 490 88" />

      <Node x={390} y={88} w={200} h={44} tone="backend" label="identify_caller" sub="phone lookup" />
      <Edge d="M 490 132 L 490 158" />

      <Diamond cx={490} cy={200} rx={100} ry={42} label="Phone known?" />

      {/* No -> new patient */}
      <Edge d="M 390 200 L 200 200 L 200 250" label="no" labelX={280} labelY={192} />
      <Node x={100} y={250} w={200} h={44} tone="backend" label="Collect full name" />
      <Edge d="M 200 294 L 200 330" />
      <Node x={100} y={330} w={200} h={44} tone="backend" label="create_patient" />
      <Edge d="M 200 374 L 200 404 L 400 404" />

      {/* Yes -> maybe family line */}
      <Edge d="M 590 200 L 790 200 L 790 250" label="yes" labelX={700} labelY={192} />
      <Diamond cx={790} cy={292} rx={92} ry={42} label="Shared line?" />
      <Edge d="M 790 334 L 790 372" label="yes → ask who" labelX={866} labelY={356} />
      <Node x={690} y={372} w={200} h={44} tone="backend" label="Select patient" />
      <Edge d="M 690 394 L 590 404" />

      <Node x={400} y={382} w={180} h={44} tone="voice" label="Capture intent" />
      <Edge d="M 490 426 L 490 456" />

      <Diamond cx={490} cy={498} rx={110} ry={42} label="Intent" />

      {/* Book branch */}
      <Edge d="M 380 498 L 170 498 L 170 560" label="book" labelX={260} labelY={490} />
      <Node x={70} y={560} w={200} h={44} tone="backend" label="find_availability" sub="live, per request" />
      <Edge d="M 170 604 L 170 636" />
      <Node x={70} y={636} w={200} h={44} tone="backend" label="book_appointment" sub="EXCLUDE guard" />

      {/* Manage branch */}
      <Edge d="M 490 540 L 490 560" label="reschedule / cancel" labelX={490} labelY={554} />
      <Node x={390} y={572} w={200} h={44} tone="backend" label="reschedule / cancel" sub="by appointment id" />

      {/* Escalate branch */}
      <Edge d="M 600 498 L 810 498 L 810 560" label="out of scope" labelX={720} labelY={490} />
      <Node x={710} y={560} w={200} h={44} tone="backend" label="log_followup" sub="human handoff" />

      {/* Interruption path */}
      <Node x={330} y={664} w={320} h={44} tone="muted" label="save_session_state on every turn" sub="interrupted calls resume from context_json" />
      <Edge d="M 270 658 L 330 686" dashed open />
      <Edge d="M 710 604 L 650 672" dashed open />
      <Edge d="M 490 616 L 490 664" dashed open />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 3. ER diagram                                                       */
/* ------------------------------------------------------------------ */

type Field = { name: string; key?: "pk" | "fk"; type?: string };

function Entity({ x, y, w, title, fields }: { x: number; y: number; w: number; title: string; fields: Field[] }) {
  const HEAD = 26;
  const ROW = 17;
  const h = HEAD + fields.length * ROW + 6;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.5} />
      <path d={`M ${x} ${y + HEAD} L ${x + w} ${y + HEAD}`} stroke="#94a3b8" strokeWidth={1.5} />
      <rect x={x} y={y} width={w} height={HEAD} rx={8} fill="#1f3b5b" />
      <rect x={x} y={y + HEAD - 8} width={w} height={8} fill="#1f3b5b" />
      <text x={x + 10} y={y + 18} fill={TEXT_ON_DARK} fontSize={12.5} fontWeight={700} fontFamily="ui-monospace, monospace">
        {title}
      </text>
      {fields.map((f, i) => (
        <g key={f.name}>
          <text x={x + 10} y={y + HEAD + 13 + i * ROW} fill={f.key ? "#1d4ed8" : "#475569"} fontSize={11} fontFamily="ui-monospace, monospace" fontWeight={f.key ? 700 : 400}>
            {f.key === "pk" ? "◆ " : f.key === "fk" ? "◇ " : "  "}
            {f.name}
          </text>
          {f.type && (
            <text x={x + w - 10} y={y + HEAD + 13 + i * ROW} textAnchor="end" fill="#94a3b8" fontSize={10} fontFamily="ui-monospace, monospace">
              {f.type}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

/** Crow's-foot "many" terminator pointing left-to-right along the edge end. */
function Rel({ d, label, labelX, labelY }: { d: string; label?: string; labelX?: number; labelY?: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke="#64748b" strokeWidth={1.5} />
      {label && labelX !== undefined && labelY !== undefined && (
        <text x={labelX} y={labelY} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={600}>
          {label}
        </text>
      )}
    </g>
  );
}

export function ErDiagram() {
  return (
    <Frame viewBox="0 0 1080 760" minWidth={900} label="Entity relationship diagram of the Supabase Postgres schema">
      <Entity
        x={30} y={40} w={215} title="branches"
        fields={[
          { name: "id", key: "pk", type: "text" },
          { name: "name", type: "text" },
          { name: "tz", type: "text" },
          { name: "open_time / close_time", type: "time" },
          { name: "buffer_minutes", type: "int" },
          { name: "cliniko_business_id", type: "text" },
        ]}
      />
      <Entity
        x={30} y={210} w={215} title="appointment_types"
        fields={[
          { name: "id", key: "pk", type: "text" },
          { name: "name", type: "text" },
          { name: "duration_min", type: "int" },
          { name: "cliniko_..._type_id", type: "text" },
        ]}
      />
      <Entity
        x={30} y={340} w={215} title="practitioners"
        fields={[
          { name: "id", key: "pk", type: "text" },
          { name: "full_name", type: "text" },
          { name: "specialty", type: "text" },
          { name: "cliniko_practitioner_id", type: "text" },
        ]}
      />
      <Entity
        x={30} y={480} w={215} title="practitioner_schedules"
        fields={[
          { name: "id", key: "pk", type: "bigserial" },
          { name: "practitioner_id", key: "fk", type: "text" },
          { name: "branch_id", key: "fk", type: "text" },
          { name: "weekday", type: "1..7 ISO" },
          { name: "start_time / end_time", type: "time" },
        ]}
      />
      <Entity
        x={30} y={630} w={215} title="practitioner_appointment_types"
        fields={[
          { name: "practitioner_id", key: "pk", type: "fk" },
          { name: "appointment_type_id", key: "pk", type: "fk" },
        ]}
      />

      <Entity
        x={410} y={40} w={240} title="appointments"
        fields={[
          { name: "id", key: "pk", type: "uuid" },
          { name: "patient_id", key: "fk", type: "uuid" },
          { name: "practitioner_id", key: "fk", type: "text" },
          { name: "branch_id", key: "fk", type: "text" },
          { name: "appointment_type_id", key: "fk", type: "text" },
          { name: "start_ts / end_ts", type: "timestamptz" },
          { name: "status", type: "booked|cancelled" },
          { name: "origin", type: "agent|cliniko" },
          { name: "pms_sync_state", type: "text" },
          { name: "idempotency_key", type: "unique" },
          { name: "cliniko_appointment_id", type: "text" },
        ]}
      />
      <Entity
        x={410} y={330} w={240} title="patients"
        fields={[
          { name: "id", key: "pk", type: "uuid" },
          { name: "full_name", type: "text" },
          { name: "dob", type: "date" },
          { name: "cliniko_patient_id", type: "text" },
        ]}
      />
      <Entity
        x={410} y={470} w={240} title="patient_phones"
        fields={[
          { name: "phone_e164", key: "pk", type: "text" },
          { name: "patient_id", key: "pk", type: "fk uuid" },
        ]}
      />
      <Entity
        x={410} y={580} w={240} title="followups"
        fields={[
          { name: "id", key: "pk", type: "uuid" },
          { name: "patient_id", key: "fk", type: "uuid" },
          { name: "phone_e164", type: "text" },
          { name: "reason / notes", type: "text" },
          { name: "resolved", type: "boolean" },
        ]}
      />

      <Entity
        x={800} y={40} w={245} title="pms_outbox"
        fields={[
          { name: "id", key: "pk", type: "uuid" },
          { name: "appointment_id", key: "fk", type: "uuid" },
          { name: "idempotency_key", type: "unique" },
          { name: "operation", type: "create|cancel" },
          { name: "payload_json", type: "jsonb" },
          { name: "status / attempts", type: "text · int" },
        ]}
      />
      <Entity
        x={800} y={230} w={245} title="call_sessions"
        fields={[
          { name: "id", key: "pk", type: "uuid" },
          { name: "patient_id", key: "fk", type: "uuid" },
          { name: "phone_e164", type: "text" },
          { name: "direction", type: "in|outbound" },
          { name: "state", type: "active|interrupted" },
          { name: "context_json", type: "jsonb" },
          { name: "transcript_json", type: "jsonb" },
          { name: "bolna_execution_id", type: "text" },
        ]}
      />
      <Entity
        x={800} y={470} w={245} title="outbound_calls"
        fields={[
          { name: "id", key: "pk", type: "uuid" },
          { name: "patient_id", key: "fk", type: "uuid" },
          { name: "session_id", key: "fk", type: "uuid" },
          { name: "purpose", type: "callback|reminder" },
          { name: "status", type: "pending|calling" },
          { name: "attempts / max_attempts", type: "int" },
          { name: "next_attempt_at", type: "timestamptz" },
        ]}
      />

      {/* Relationships */}
      <Rel d="M 245 75 L 330 75 L 330 100 L 410 100" label="1:N" labelX={330} labelY={68} />
      <Rel d="M 245 245 L 350 245 L 350 130 L 410 130" label="1:N" labelX={350} labelY={238} />
      <Rel d="M 245 375 L 370 375 L 370 115 L 410 115" label="1:N" labelX={300} labelY={368} />
      <Rel d="M 245 510 L 290 510 L 290 400 L 150 400 L 150 424" label="1:N" labelX={295} labelY={455} />
      <Rel d="M 137 424 L 137 480" />
      <Rel d="M 137 630 L 137 604" label="M:N" labelX={175} labelY={620} />
      <Rel d="M 245 655 L 300 655 L 300 290 L 150 290" />

      <Rel d="M 530 330 L 530 275" label="1:N" labelX={562} labelY={306} />
      <Rel d="M 530 430 L 530 470" label="1:N" labelX={562} labelY={454} />
      <Rel d="M 530 430 L 700 430 L 700 580 L 650 620" label="1:N" labelX={700} labelY={506} />
      <Rel d="M 650 100 L 730 100 L 730 90 L 800 90" label="1:N" labelX={730} labelY={80} />
      <Rel d="M 650 400 L 760 400 L 760 300 L 800 300" label="1:N" labelX={760} labelY={352} />
      <Rel d="M 922 386 L 922 470" label="1:N" labelX={955} labelY={432} />
      <Rel d="M 650 415 L 770 415 L 770 540 L 800 540" label="1:N" labelX={770} labelY={480} />

      {/* Legend */}
      <g>
        <rect x={30} y={710} width={430} height={34} rx={8} fill="#f8fafc" stroke="#cbd5e1" />
        <text x={44} y={732} fill="#475569" fontSize={11} fontFamily="ui-monospace, monospace">
          ◆ primary key    ◇ foreign key    1:N one-to-many    M:N join table
        </text>
      </g>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Booking sequence diagram                                         */
/* ------------------------------------------------------------------ */

export function BookingSequenceDiagram() {
  const actors = [
    { x: 90, label: "Caller" },
    { x: 285, label: "Bolna" },
    { x: 490, label: "FastAPI" },
    { x: 700, label: "Postgres" },
    { x: 900, label: "Cliniko" },
  ];
  const TOP = 62;
  const BOTTOM = 640;

  const msgs: { from: number; to: number; y: number; label: string; dashed?: boolean }[] = [
    { from: 0, to: 1, y: 100, label: "dials clinic number" },
    { from: 1, to: 2, y: 138, label: "identify_caller(phone)" },
    { from: 2, to: 3, y: 172, label: "select patients by phone" },
    { from: 3, to: 2, y: 202, label: "0..N matches", dashed: true },
    { from: 2, to: 1, y: 232, label: "known / new + names", dashed: true },
    { from: 1, to: 2, y: 276, label: "find_availability(doctor, date)" },
    { from: 2, to: 3, y: 310, label: "schedules − booked appts" },
    { from: 3, to: 2, y: 340, label: "derived free slots", dashed: true },
    { from: 1, to: 0, y: 374, label: "offers slots aloud", dashed: true },
    { from: 0, to: 1, y: 408, label: "verbal confirmation" },
    { from: 1, to: 2, y: 442, label: "book_appointment(slot)" },
    { from: 2, to: 3, y: 476, label: "INSERT — EXCLUDE guard" },
    { from: 3, to: 2, y: 506, label: "committed or 409 conflict", dashed: true },
    { from: 2, to: 3, y: 536, label: "INSERT pms_outbox row" },
    { from: 2, to: 1, y: 566, label: "confirmation payload", dashed: true },
    { from: 2, to: 4, y: 600, label: "worker drains outbox → create appointment" },
  ];

  return (
    <Frame viewBox="0 0 1000 690" minWidth={860} label="Sequence diagram for identifying a caller and booking an appointment">
      {actors.map((a) => (
        <g key={a.label}>
          <rect x={a.x - 62} y={20} width={124} height={36} rx={8} fill="#1f3b5b" stroke="#6ea8ff" strokeWidth={1.5} />
          <text x={a.x} y={43} textAnchor="middle" fill={TEXT_ON_DARK} fontSize={13} fontWeight={600}>
            {a.label}
          </text>
          <path d={`M ${a.x} ${TOP} L ${a.x} ${BOTTOM}`} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="5 5" />
        </g>
      ))}

      {msgs.map((m, i) => {
        const x1 = actors[m.from].x;
        const x2 = actors[m.to].x;
        const dir = x2 > x1 ? 1 : -1;
        return (
          <g key={i}>
            <path
              d={`M ${x1 + dir * 4} ${m.y} L ${x2 - dir * 8} ${m.y}`}
              stroke={m.dashed ? "#94a3b8" : "#475569"}
              strokeWidth={1.8}
              strokeDasharray={m.dashed ? "6 4" : undefined}
              markerEnd="url(#doc-arrow)"
            />
            <text x={(x1 + x2) / 2} y={m.y - 7} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={500}>
              {m.label}
            </text>
          </g>
        );
      })}

      {/* Phase brackets */}
      <g>
        <path d="M 24 132 L 16 132 L 16 240 L 24 240" fill="none" stroke="#94a3b8" strokeWidth={1.5} />
        <text x={20} y={190} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={700} transform="rotate(-90 20 190)">
          IDENTIFY
        </text>
        <path d="M 24 270 L 16 270 L 16 415 L 24 415" fill="none" stroke="#94a3b8" strokeWidth={1.5} />
        <text x={20} y={342} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={700} transform="rotate(-90 20 342)">
          AVAILABILITY
        </text>
        <path d="M 24 436 L 16 436 L 16 610 L 24 610" fill="none" stroke="#94a3b8" strokeWidth={1.5} />
        <text x={20} y={523} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={700} transform="rotate(-90 20 523)">
          COMMIT
        </text>
      </g>

      <rect x={330} y={648} width={520} height={30} rx={8} fill="#f8fafc" stroke="#cbd5e1" />
      <text x={590} y={668} textAnchor="middle" fill={TEXT_ON_LIGHT} fontSize={11}>
        Postgres commits first; Cliniko write-back is asynchronous and retried via pms_outbox
      </text>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Outbound call state machine                                      */
/* ------------------------------------------------------------------ */

export function OutboundStateDiagram() {
  return (
    <Frame viewBox="0 0 940 400" minWidth={780} label="State machine for outbound call retry handling">
      <circle cx={48} cy={180} r={12} fill="#1f3b5b" />
      <Edge d="M 62 180 L 100 180" />

      <Node x={100} y={156} w={130} h={48} tone="data" label="pending" sub="next_attempt_at" />
      <Edge d="M 230 180 L 300 180" label="worker picks up" labelX={265} labelY={170} />
      <Node x={300} y={156} w={130} h={48} tone="voice" label="calling" sub="Bolna dial" />

      <Edge d="M 430 168 L 520 96" label="answered" labelX={470} labelY={120} />
      <Node x={520} y={72} w={150} h={48} tone="backend" label="completed" />

      <Edge d="M 430 192 L 520 180" label="no answer / failed" labelX={480} labelY={214} />
      <Node x={520} y={156} w={150} h={48} tone="decision" label="no_answer / failed" />

      <Edge d="M 595 204 L 595 268 L 165 268 L 165 204" label="attempts < max_attempts → backoff" labelX={380} labelY={288} dashed />

      <Edge d="M 670 180 L 740 180" label="attempts = max" labelX={705} labelY={170} />
      <Node x={740} y={156} w={150} h={48} tone="external" label="max_retries" sub="terminal" />

      <Edge d="M 165 204 L 165 330 L 740 330 L 740 300" label="operator cancels" labelX={430} labelY={350} dashed />
      <Node x={740} y={252} w={150} h={48} tone="external" label="cancelled" sub="terminal" />

      <Edge d="M 365 156 L 365 96 L 520 96" label="dropped mid-call → re-queued as continue" labelX={400} labelY={54} dashed />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Frontend component tree                                          */
/* ------------------------------------------------------------------ */

export function ComponentTreeDiagram() {
  const leaves = [
    ["Dashboard", "KPIs, quick actions"],
    ["Calendar", "week grid"],
    ["Appointments", "list + filters"],
    ["Patients", "registry"],
    ["InboundCalls", "live monitor"],
    ["Outbound", "retry queue"],
    ["Followups", "escalations"],
    ["Sessions", "context debug"],
    ["ClinicSetup", "branches, hours"],
    ["Documentation", "these pages"],
  ];

  return (
    <Frame viewBox="0 0 1000 520" minWidth={820} label="React component hierarchy for the operations dashboard">
      <Node x={400} y={16} w={190} h={48} tone="data" label="App.tsx" sub="route + view state" />

      <Edge d="M 460 64 L 200 108" />
      <Edge d="M 530 64 L 530 108" />

      <Node x={100} y={108} w={200} h={44} tone="voice" label="Sidebar" sub="navigation" />
      <Node x={430} y={108} w={200} h={44} tone="voice" label="Active view" sub="switch on nav key" />

      {leaves.map((l, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const x = 40 + col * 192;
        const y = 220 + row * 92;
        return (
          <g key={l[0]}>
            <Edge d={`M 530 152 L ${x + 84} ${y}`} open />
            <Node x={x} y={y} w={168} h={44} tone="backend" label={l[0]} sub={l[1]} />
          </g>
        );
      })}

      <rect x={40} y={412} width={920} height={84} rx={10} fill="#f8fafc" stroke="#cbd5e1" />
      <text x={56} y={436} fill="#334155" fontSize={12} fontWeight={700}>
        Shared foundation
      </text>
      <text x={56} y={458} fill="#475569" fontSize={11.5}>
        components/ui/ — Button · Card · Input · Select · Dialog · Badge · Table · Label · Textarea
      </text>
      <text x={56} y={478} fill="#475569" fontSize={11.5}>
        app/api.ts — typed fetch client · StateBlock loading + error/retry pattern · useEffect auto-refresh
      </text>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Deployment topology                                              */
/* ------------------------------------------------------------------ */

export function DeploymentDiagram() {
  return (
    <Frame viewBox="0 0 960 430" minWidth={780} label="Deployment topology across hosting providers and managed services">
      <g>
        <rect x={30} y={40} width={260} height={160} rx={12} fill="#ffffff" stroke="#cbd5e1" strokeDasharray="6 4" />
        <LaneLabel x={44} y={62} text="Static host (Vercel)" />
        <Node x={54} y={82} w={210} h={44} tone="voice" label="React SPA" sub="Vite build output" />
        <text x={60} y={158} fill="#64748b" fontSize={11}>
          VITE_API_BASE_URL →
        </text>
        <text x={60} y={176} fill="#64748b" fontSize={11}>
          backend origin
        </text>
      </g>

      <g>
        <rect x={350} y={40} width={280} height={230} rx={12} fill="#ffffff" stroke="#cbd5e1" strokeDasharray="6 4" />
        <LaneLabel x={364} y={62} text="Python host (persistent)" />
        <Node x={374} y={82} w={230} h={44} tone="backend" label="FastAPI (uvicorn)" sub="tools · webhooks · API" />
        <Node x={374} y={146} w={230} h={44} tone="backend" label="Background workers" sub="outbox drain · outbound" />
        <text x={380} y={218} fill="#64748b" fontSize={11}>
          ngrok tunnel for local
        </text>
        <text x={380} y={236} fill="#64748b" fontSize={11}>
          telephony testing
        </text>
      </g>

      <g>
        <rect x={690} y={40} width={240} height={340} rx={12} fill="#ffffff" stroke="#cbd5e1" strokeDasharray="6 4" />
        <LaneLabel x={704} y={62} text="Managed services" />
        <Node x={714} y={82} w={190} h={44} tone="data" label="Supabase" sub="Postgres + RLS" />
        <Node x={714} y={146} w={190} h={44} tone="external" label="Cliniko" sub="shard au5" />
        <Node x={714} y={210} w={190} h={44} tone="voice" label="Bolna" sub="agent config" />
        <Node x={714} y={274} w={190} h={44} tone="voice" label="Twilio" sub="verified numbers" />
      </g>

      <Edge d="M 290 110 L 350 110" label="HTTPS" labelX={320} labelY={102} />
      <Edge d="M 604 104 L 714 104" open />
      <Edge d="M 604 116 L 714 168" open />
      <Edge d="M 604 168 L 714 232" open />
      <Edge d="M 714 296 L 640 250 L 604 190" label="inbound webhook" labelX={640} labelY={330} dashed />

      <rect x={30} y={300} width={600} height={80} rx={10} fill="#f8fafc" stroke="#cbd5e1" />
      <text x={46} y={324} fill="#334155" fontSize={12} fontWeight={700}>
        Deployment constraints
      </text>
      <text x={46} y={346} fill="#475569" fontSize={11.5}>
        Backend must be a persistent host — serverless breaks the background workers and tunnel state.
      </text>
      <text x={46} y={366} fill="#475569" fontSize={11.5}>
        Free-tier Twilio requires both inbound and outbound numbers to be verified before testing.
      </text>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Shared caption wrapper                                              */
/* ------------------------------------------------------------------ */

export function DiagramCard({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {caption && <p className="mt-1 text-sm text-gray-600">{caption}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
