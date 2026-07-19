import { useEffect, useState, ReactNode } from "react";

/** Load a promise on mount + on refreshKey change; expose data/loading/error. */
export function useLoad<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fn().then(d => { if (alive) { setData(d); setLoading(false); } })
        .catch(e => { if (alive) { setError(String(e.message || e)); setLoading(false); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error, setData };
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

export function Stat({ n, label, tone = "" }: { n: ReactNode; label: string; tone?: string }) {
  return (
    <Card className="p-5">
      <div className={`text-3xl font-bold ${tone}`}>{n}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </Card>
  );
}

const TONES: Record<string, string> = {
  booked: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  synced: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  calling: "bg-amber-50 text-amber-700 border-amber-200",
  active: "bg-amber-50 text-amber-700 border-amber-200",
  interrupted: "bg-orange-50 text-orange-700 border-orange-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  max_retries: "bg-red-50 text-red-700 border-red-200",
  no_answer: "bg-red-50 text-red-700 border-red-200",
  callback_pending: "bg-red-50 text-red-700 border-red-200",
};

export function Pill({ value }: { value: string }) {
  const tone = TONES[value] || "bg-gray-50 text-gray-600 border-gray-200";
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${tone}`}>{value || "—"}</span>;
}

export function fmt(ts?: string) {
  if (!ts) return "—";
  return String(ts).replace("T", " ").slice(0, 16);
}

export function DataTable({ cols, rows, render, empty = "Nothing yet." }:
  { cols: string[]; rows: any[]; render: (r: any) => ReactNode[]; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            {cols.map(c => <th key={c} className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} className="px-4 py-6 text-gray-400">{empty}</td></tr>
            : rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                {render(r).map((c, j) => <td key={j} className="px-4 py-2.5 whitespace-nowrap">{c}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function StateBlock({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <div className="text-gray-400 py-6 px-4">Loading…</div>;
  if (error) return <div className="text-red-600 py-6 px-4">Error: {error}</div>;
  return null;
}
