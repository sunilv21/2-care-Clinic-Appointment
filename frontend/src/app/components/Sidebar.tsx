import { useState, useEffect } from "react";
import {
  LayoutDashboard, CalendarCheck, CalendarDays, Users, PhoneIncoming, PhoneOutgoing, Bell, PhoneCall, Building2, HeartPulse, Circle, TerminalSquare, BookOpen,
} from "lucide-react";
import { cn } from "./ui/utils";
import { getCliniko, getBolna } from "../api";

export type View =
  | "overview" | "inbound" | "calendar" | "appointments" | "patients" | "outbound" | "followups" | "sessions" | "clinic-setup" | "system-prompt" | "readme";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  lastRefresh: Date;
}

export function Sidebar({ currentView, onViewChange, lastRefresh }: SidebarProps) {
  const [cliniko, setCliniko] = useState<any>(null);
  const [bolna, setBolna] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      try { setCliniko(await getCliniko()); } catch { setCliniko({ ok: false }); }
      try { setBolna(await getBolna()); } catch { setBolna({ ok: false }); }
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  const navItems: { id: View; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "inbound", label: "Inbound Calls", icon: PhoneIncoming },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "appointments", label: "Appointments", icon: CalendarCheck },
    { id: "patients", label: "Patients", icon: Users },
    { id: "outbound", label: "Outbound Calls", icon: PhoneOutgoing },
    { id: "followups", label: "Follow-ups", icon: Bell },
    { id: "sessions", label: "Call Sessions", icon: PhoneCall },
    { id: "clinic-setup", label: "Clinic Setup", icon: Building2 },
    { id: "system-prompt", label: "System Prompt", icon: TerminalSquare },
    { id: "readme", label: "README", icon: BookOpen },
  ];

  const clinikoOk = cliniko?.ok;
  const bolnaOk = bolna?.ok;
  const bolnaReady = bolnaOk && bolna?.setup_complete;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <HeartPulse className="size-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Aarogya Clinic</h2>
            <p className="text-xs text-gray-500">Voice Receptionist</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-emerald-50 text-emerald-700" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-2">
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
          clinikoOk ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          <div className={`size-2 rounded-full ${clinikoOk ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <span className="flex-1">{clinikoOk ? `Cliniko ${cliniko.shard} connected` : "Cliniko not connected"}</span>
        </div>
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
          bolnaReady ? "bg-green-50 text-green-800 border border-green-200"
            : bolnaOk ? "bg-amber-50 text-amber-800 border border-amber-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          <div className={`size-2 rounded-full ${bolnaReady ? "bg-green-500 animate-pulse" : bolnaOk ? "bg-amber-500" : "bg-red-500"}`} />
          <span className="flex-1">
            {bolnaReady ? "Bolna connected & ready" : bolnaOk ? "Bolna connected (setup incomplete)" : "Bolna not connected"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 pt-1">
          <Circle className="size-2 fill-green-500 text-green-500" />
          <span>Supabase</span>
          <span className="ml-auto">{lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>
    </aside>
  );
}
