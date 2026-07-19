import { useState, useMemo } from "react";
import { getCalendar } from "../api";
import { Card, useLoad, StateBlock } from "./clinic-ui";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_START = 8 * 60;   // 08:00
const DAY_END = 20 * 60;    // 20:00
const PX_PER_MIN = 0.9;     // grid density
const HEIGHT = (DAY_END - DAY_START) * PX_PER_MIN;

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const DOC_COLORS = ["#5b8cff", "#3ecf8e", "#f0b429", "#f2617a", "#a06bff", "#28b6c8"];

export function Calendar() {
  const [day, setDay] = useState(() => new Date());
  const dateStr = ymd(day);
  const { data, loading, error } = useLoad(() => getCalendar(dateStr, dateStr), [dateStr]);

  const doctors = data?.doctors ?? [];
  const events = (data?.events ?? []).filter(e => e.date === dateStr);
  const colorFor = useMemo(() => {
    const m: Record<string, string> = {};
    doctors.forEach((d, i) => { m[d.id] = DOC_COLORS[i % DOC_COLORS.length]; });
    return m;
  }, [doctors]);

  const hours = [];
  for (let m = DAY_START; m <= DAY_END; m += 60) hours.push(m);

  const isToday = ymd(new Date()) === dateStr;
  const dayLabel = day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setDay(addDays(day, -1))} className="p-2 rounded-lg border border-gray-300 hover:border-blue-500"><ChevronLeft className="size-4" /></button>
        <button onClick={() => setDay(new Date())} className={`px-3 py-1.5 rounded-lg border text-sm ${isToday ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-300"}`}>Today</button>
        <button onClick={() => setDay(addDays(day, 1))} className="p-2 rounded-lg border border-gray-300 hover:border-blue-500"><ChevronRight className="size-4" /></button>
        <input type="date" value={dateStr} onChange={e => e.target.value && setDay(new Date(e.target.value + "T00:00:00"))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        <div className="font-semibold text-gray-900 ml-1">{dayLabel}</div>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-blue-500 inline-block" />Agent</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm inline-block" style={{ background: "#a06bff" }} />Cliniko</span>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <StateBlock loading={loading} error={error} />
        {data && (
          <div className="overflow-x-auto">
            {/* doctor column headers */}
            <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0" style={{ minWidth: 120 + doctors.length * 180 }}>
              <div className="w-[70px] shrink-0" />
              {doctors.map(d => (
                <div key={d.id} className="flex-1 min-w-[180px] px-3 py-2 border-l border-gray-200">
                  <div className="text-sm font-medium text-gray-900" style={{ color: colorFor[d.id] }}>{d.name}</div>
                  <div className="text-xs text-gray-500">{d.specialty}</div>
                </div>
              ))}
            </div>

            {/* time grid */}
            <div className="flex relative" style={{ minWidth: 120 + doctors.length * 180 }}>
              {/* time axis */}
              <div className="w-[70px] shrink-0 relative" style={{ height: HEIGHT }}>
                {hours.map(m => (
                  <div key={m} className="absolute right-2 text-xs text-gray-400 -translate-y-1/2"
                    style={{ top: (m - DAY_START) * PX_PER_MIN }}>
                    {String(Math.floor(m / 60)).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* doctor columns */}
              {doctors.map(d => {
                const col = events.filter(e => e.practitioner_id === d.id);
                return (
                  <div key={d.id} className="flex-1 min-w-[180px] relative border-l border-gray-200" style={{ height: HEIGHT }}>
                    {/* hour lines */}
                    {hours.map(m => (
                      <div key={m} className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: (m - DAY_START) * PX_PER_MIN }} />
                    ))}
                    {/* events */}
                    {col.map(e => {
                      const top = (e.start_min - DAY_START) * PX_PER_MIN;
                      const h = Math.max((e.end_min - e.start_min) * PX_PER_MIN, 18);
                      const color = e.origin === "cliniko_manual" ? "#a06bff" : colorFor[d.id];
                      return (
                        <div key={e.id} className="absolute left-1 right-1 rounded-md px-2 py-1 text-white overflow-hidden shadow-sm"
                          style={{ top, height: h, background: color }} title={`${e.patient} · ${e.appt_type} · ${e.start}-${e.end}`}>
                          <div className="text-[11px] font-medium leading-tight truncate">{e.patient}</div>
                          <div className="text-[10px] opacity-90 truncate">{e.start}–{e.end} · {e.appt_type}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {data && events.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-6">No appointments on this day.</div>
        )}
      </Card>
    </div>
  );
}
