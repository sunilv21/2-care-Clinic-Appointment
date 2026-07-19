import { useEffect, useState } from "react";
import { Sidebar, View } from "./components/Sidebar";
import { Overview } from "./components/Overview";
import { InboundCalls } from "./components/InboundCalls";
import { Calendar } from "./components/Calendar";
import { Appointments } from "./components/Appointments";
import { Patients } from "./components/Patients";
import { Outbound } from "./components/Outbound";
import { Followups } from "./components/Followups";
import { Sessions } from "./components/Sessions";
import { ClinicSetup } from "./components/ClinicSetup";
import { RefreshCw } from "lucide-react";
import { UnifiedDocumentationPage } from "./components/DocumentationPages";

const TITLES: Record<View, string> = {
  overview: "Overview",
  inbound: "Inbound Calls",
  calendar: "Calendar",
  appointments: "Appointments",
  patients: "Patients",
  outbound: "Outbound Calls",
  followups: "Follow-ups",
  sessions: "Call Sessions",
  "clinic-setup": "Clinic Setup",
  documentation: "Documentation",
};

function getViewFromPath(path: string): View {
  const clean = path.replace(/^\/+|\/+$/g, "");
  const map: Record<string, View> = {
    "": "overview",
    "overview": "overview",
    "inbound": "inbound",
    "calendar": "calendar",
    "appointments": "appointments",
    "patients": "patients",
    "outbound": "outbound",
    "followups": "followups",
    "sessions": "sessions",
    "clinic-setup": "clinic-setup",
    "documentation": "documentation",
  };
  return map[clean] ?? "overview";
}

function getPathFromView(view: View): string {
  return view === "overview" ? "/" : `/${view}`;
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  const navigateTo = (nextView: View) => {
    const path = getPathFromView(nextView);
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setView(nextView);
  };

  useEffect(() => {
    const syncFromUrl = () => setView(getViewFromPath(window.location.pathname));
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const refresh = () => { setLastRefresh(new Date()); setRefreshKey(k => k + 1); };

  const render = () => {
    switch (view) {
      case "overview": return <Overview key={refreshKey} />;
      case "inbound": return <InboundCalls key={refreshKey} />;
      case "calendar": return <Calendar key={refreshKey} />;
      case "appointments": return <Appointments key={refreshKey} />;
      case "patients": return <Patients key={refreshKey} />;
      case "outbound": return <Outbound key={refreshKey} />;
      case "followups": return <Followups key={refreshKey} />;
      case "sessions": return <Sessions key={refreshKey} />;
      case "clinic-setup": return <ClinicSetup key={refreshKey} />;
      case "documentation": return <UnifiedDocumentationPage onBack={() => navigateTo("overview")} />;
      default: return <Overview key={refreshKey} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentView={view} onViewChange={navigateTo} lastRefresh={lastRefresh} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{TITLES[view]}</h1>
              <p className="text-sm text-gray-500 mt-1">Aarogya Multi-Speciality Clinic · voice receptionist ops</p>
            </div>
            <button onClick={refresh}
              className="inline-flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2 text-sm hover:border-blue-500">
              <RefreshCw className="size-4" /> Refresh
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-8">{render()}</main>
      </div>
    </div>
  );
}
