import { ArrowLeft, BookOpen, Bot, Code, FileText, Layout, Rocket, ShieldCheck, TerminalSquare, Workflow } from "lucide-react";
import { useState } from "react";
import {
  SystemArchitectureDiagram,
  CallFlowchartDiagram,
  ErDiagram,
  BookingSequenceDiagram,
  OutboundStateDiagram,
  ComponentTreeDiagram,
  DeploymentDiagram,
  DiagramCard,
} from "./DocDiagrams";

interface DocumentationPageProps {
  onBack: () => void;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-gray-700">{children}</div>
    </div>
  );
}

type DocTab = "overview" | "getting-started" | "api-docs" | "component-docs" | "system-prompt" | "readme";

const TABS: { id: DocTab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Workflow },
  { id: "getting-started", label: "Getting Started", icon: Rocket },
  { id: "api-docs", label: "API Docs", icon: Code },
  { id: "component-docs", label: "Component Docs", icon: Layout },
  { id: "system-prompt", label: "System Prompt", icon: TerminalSquare },
  { id: "readme", label: "README", icon: BookOpen },
];

export function UnifiedDocumentationPage({ onBack }: DocumentationPageProps) {
  const [activeTab, setActiveTab] = useState<DocTab>("overview");

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Workflow className="size-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Architecture and implementation guide</h2>
                  <p className="text-sm text-gray-600">A condensed version of the repository README, adapted for the frontend experience.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <SectionCard title="Architecture">
                  <p>Caller → Bolna → FastAPI tools → Supabase/Cliniko. Bolna owns the live call, the backend exposes tool webhooks and business logic, and the dashboard is optional for operations.</p>
                </SectionCard>
                <SectionCard title="Why Bolna">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Inbound + tool-calling fits live phone support</li>
                    <li>Small strongly-typed tools improves reliability</li>
                    <li>Multilingual call handling works natively at the provider layer</li>
                  </ul>
                </SectionCard>
                <SectionCard title="Backend capabilities">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Live availability engine based on working hours and bookings</li>
                    <li>Double-booking prevention through database constraints</li>
                    <li>Cliniko write-back and reconcile worker support</li>
                  </ul>
                </SectionCard>
                <SectionCard title="Ops dashboard">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Overview, appointments, patients, sessions, follow-ups</li>
                    <li>Inbound/outbound call visibility</li>
                    <li>Read-only data views plus explicit operational actions</li>
                  </ul>
                </SectionCard>
              </div>
            </div>

            <DiagramCard title="System architecture" caption="Layered view from caller through telephony, application and data.">
              <SystemArchitectureDiagram />
            </DiagramCard>

            <DiagramCard title="Call handling flowchart" caption="Decision logic from connection through identification, intent routing and interruption recovery.">
              <CallFlowchartDiagram />
            </DiagramCard>

            <DiagramCard title="Booking sequence" caption="Message order between caller, Bolna, FastAPI, Postgres and Cliniko for a single booking.">
              <BookingSequenceDiagram />
            </DiagramCard>

            <DiagramCard title="Data model (ER diagram)" caption="Supabase Postgres schema — source of truth for scheduling, patients and call state.">
              <ErDiagram />
            </DiagramCard>
          </div>
        );

      case "getting-started":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Rocket className="size-6 text-green-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Getting Started Guide</h2>
                  <p className="text-sm text-gray-600">Comprehensive setup guide for new developers to get the Aarogya Clinic system running.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Prerequisites">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Node.js (v18 or higher)</li>
                  <li>Python (v3.9 or higher)</li>
                  <li>Git</li>
                  <li>Supabase account (free tier)</li>
                  <li>Cliniko account (trial)</li>
                  <li>Bolna account (trial)</li>
                  <li>Twilio account (trial)</li>
                </ul>
              </SectionCard>
              <SectionCard title="Quick Setup">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Clone the repository</li>
                  <li>Setup backend (install dependencies, configure .env)</li>
                  <li>Apply database migrations</li>
                  <li>Seed Cliniko and Supabase</li>
                  <li>Start backend server</li>
                  <li>Setup frontend and start dev server</li>
                </ul>
              </SectionCard>
              <SectionCard title="Development Workflow">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Backend changes require server restart</li>
                  <li>Frontend hot-reloads automatically</li>
                  <li>Run eval harness for testing</li>
                  <li>Use ngrok for local telephony testing</li>
                </ul>
              </SectionCard>
              <SectionCard title="Key Components">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Bolna Voice Platform - handles calls and speech</li>
                  <li>FastAPI Backend - business logic and tools</li>
                  <li>Supabase Database - scheduling and state</li>
                  <li>Cliniko PMS - system of record</li>
                  <li>React Dashboard - operations interface</li>
                </ul>
              </SectionCard>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Quick Start Commands</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Backend Setup</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>cd backend
pip install -r requirements.txt
python -m db.apply
python -m seed.seed_cliniko --apply
python -m db.seed_supabase
python run.py</code>
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Frontend Setup</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>cd frontend
npm install
npm run dev</code>
                  </pre>
                </div>
              </div>
            </div>

            <DiagramCard title="Deployment topology" caption="Where each piece runs: static frontend host, persistent Python backend, and managed third-party services.">
              <DeploymentDiagram />
            </DiagramCard>
          </div>
        );

      case "api-docs":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Code className="size-6 text-purple-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">API Reference</h2>
                  <p className="text-sm text-gray-600">Complete API documentation for all backend endpoints and tool integrations.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Tool Endpoints (Bolna Agent)">
                <ul className="list-disc space-y-1 pl-5">
                  <li>identify_caller - Patient identification</li>
                  <li>create_patient - New patient registration</li>
                  <li>get_doctors - Doctor listings</li>
                  <li>get_branch_info - Branch information</li>
                  <li>find_availability - Slot search</li>
                  <li>get_earliest_slot - Earliest availability</li>
                  <li>book_appointment - Booking confirmation</li>
                  <li>get_patient_appointments - Appointment lookup</li>
                  <li>reschedule_appointment - Rescheduling</li>
                  <li>cancel_appointment - Cancellation</li>
                  <li>log_followup - Escalation logging</li>
                  <li>save_session_state - State persistence</li>
                </ul>
              </SectionCard>
              <SectionCard title="Dashboard API Endpoints">
                <ul className="list-disc space-y-1 pl-5">
                  <li>/api/dashboard/summary - KPI summary</li>
                  <li>/api/dashboard/clinic - Branches, doctors, appointment types</li>
                  <li>/api/dashboard/appointments - Appointment list</li>
                  <li>/api/dashboard/calendar - Calendar grid data</li>
                  <li>/api/dashboard/patients - Patient registry</li>
                  <li>/api/dashboard/outbound - Outbound call queue</li>
                  <li>/api/dashboard/followups (+ /{"{"}id{"}"}/resolve) - Escalation tracking</li>
                  <li>/api/dashboard/sessions - Call session debugging</li>
                  <li>/api/dashboard/inbound (+ /{"{"}session_id{"}"}) - Inbound call detail</li>
                  <li>/api/dashboard/cliniko, /bolna - Integration status</li>
                  <li>/api/dashboard/availability - Live availability check</li>
                  <li>/health - System health check (no /api prefix)</li>
                </ul>
              </SectionCard>
              <SectionCard title="Authentication">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Tool endpoints use X-Tool-Secret header</li>
                  <li>Dashboard endpoints currently have no auth</li>
                  <li>CORS configured via ALLOWED_ORIGINS</li>
                  <li>Shared secret for single-tenant demo</li>
                </ul>
              </SectionCard>
              <SectionCard title="Base URL Configuration">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Local: http://localhost:8080</li>
                  <li>Production: Deployed backend URL</li>
                  <li>Frontend: VITE_API_BASE_URL env var</li>
                  <li>Vite proxy handles local development</li>
                </ul>
              </SectionCard>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Error Handling</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-800">400 Bad Request</p>
                  <p className="text-sm text-red-600 mt-1">Invalid request parameters</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="font-medium text-yellow-800">401 Unauthorized</p>
                  <p className="text-sm text-yellow-600 mt-1">Missing or invalid authentication</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="font-medium text-orange-800">409 Conflict</p>
                  <p className="text-sm text-orange-600 mt-1">Resource conflict (double booking)</p>
                </div>
              </div>
            </div>

            <DiagramCard title="Tool-call booking sequence" caption="How a Bolna tool call travels through FastAPI to Postgres and, asynchronously, to Cliniko.">
              <BookingSequenceDiagram />
            </DiagramCard>

            <DiagramCard title="Outbound call state machine" caption="/outbound/enqueue and /outbound/process retry logic, keyed by outbound_calls.status.">
              <OutboundStateDiagram />
            </DiagramCard>
          </div>
        );

      case "component-docs":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Layout className="size-6 text-orange-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">React Component Guide</h2>
                  <p className="text-sm text-gray-600">Documentation for all React components used in the Aarogya Clinic dashboard.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Base UI Components">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Button - Various styles and sizes</li>
                  <li>Card - Content containers</li>
                  <li>Input - Text input with validation</li>
                  <li>Select - Dropdown component</li>
                  <li>Dialog - Modal dialogs</li>
                  <li>Badge - Status indicators</li>
                  <li>Table - Data tables</li>
                  <li>Label - Form labels</li>
                  <li>Textarea - Multi-line input</li>
                </ul>
              </SectionCard>
              <SectionCard title="Feature Components">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Dashboard - KPIs and quick actions</li>
                  <li>Calendar - Cliniko-style grid view</li>
                  <li>InboundCalls - Call monitoring</li>
                  <li>Appointments - Appointment management</li>
                  <li>Patients - Patient registry</li>
                  <li>Outbound - Outbound call queue</li>
                  <li>Followups - Escalation tracking</li>
                  <li>Sessions - Call session debugging</li>
                </ul>
              </SectionCard>
              <SectionCard title="Component Patterns">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Loading pattern with StateBlock</li>
                  <li>Error handling with retry</li>
                  <li>Navigation via callback props</li>
                  <li>Data fetching from API client</li>
                  <li>Auto-refresh with useEffect</li>
                </ul>
              </SectionCard>
              <SectionCard title="Styling Guidelines">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Tailwind CSS utility classes</li>
                  <li>Consistent spacing system</li>
                  <li>Color palette for semantic meaning</li>
                  <li>Responsive design patterns</li>
                  <li>Gradient usage for emphasis</li>
                </ul>
              </SectionCard>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Component Architecture</h3>
              <div className="mt-4 text-sm text-gray-700">
                <p className="mb-2">Components are organized by feature domain in <code className="bg-gray-100 px-2 py-1 rounded">src/app/components/</code>:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li><strong>ui/</strong> - Reusable base components (Button, Card, Input, etc.)</li>
                  <li><strong>Dashboard.tsx</strong> - Main dashboard with KPIs and quick actions</li>
                  <li><strong>Calendar.tsx</strong> - Appointment calendar grid</li>
                  <li><strong>*Calls.tsx</strong> - Call management components</li>
                  <li><strong>Patients.tsx</strong> - Patient management</li>
                  <li><strong>Sidebar.tsx</strong> - Navigation sidebar</li>
                </ul>
              </div>
            </div>

            <DiagramCard title="Component tree" caption="How App.tsx routes into the sidebar-driven feature views, on top of the shared ui/ primitives and api.ts client.">
              <ComponentTreeDiagram />
            </DiagramCard>
          </div>
        );

      case "system-prompt":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <TerminalSquare className="size-6 text-blue-300" />
                <div>
                  <h2 className="text-xl font-semibold">Enterprise voice agent documentation</h2>
                  <p className="text-sm text-slate-300">Operational standards, workflow logic, and deployment notes for the Aarogya receptionist.</p>
                </div>
              </div>
            </div>

            <DiagramCard title="Call handling flowchart" caption="Decision logic the agent follows on every call, including the shared-line and interruption-recovery branches.">
              <CallFlowchartDiagram />
            </DiagramCard>

            <DiagramCard title="Booking sequence" caption="Identify → availability → booking → save state → webhook, as message order between systems.">
              <BookingSequenceDiagram />
            </DiagramCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Role definition">
                <p>You are the AI receptionist for Aarogya Multi-Speciality Clinic serving Indiranagar. You handle the full call yourself, support English, Hindi, and Hinglish, and always mirror the caller's language.</p>
              </SectionCard>
              <SectionCard title="Primary objective">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Book, reschedule, and cancel appointments</li>
                  <li>Answer branch, hours, and policy questions</li>
                  <li>Register new patients and recognize returning patients</li>
                  <li>Resume dropped calls and log follow-up requests</li>
                </ul>
              </SectionCard>
              <SectionCard title="Conversation rules">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Never ask a question that does not move the booking forward</li>
                  <li>Do not ask for information already captured in the current call</li>
                  <li>Keep responses short, warm, and professional</li>
                </ul>
              </SectionCard>
              <SectionCard title="Patient identification">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Call identify_caller at the beginning of every call</li>
                  <li>If the patient is new, collect the full name before booking</li>
                  <li>If the line is shared, ask whose appointment it is before proceeding</li>
                </ul>
              </SectionCard>
              <SectionCard title="Availability and booking">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Use live availability for every new date or time request</li>
                  <li>Never reuse an old availability result</li>
                  <li>Confirm doctor, branch, time, and verbal agreement before booking</li>
                </ul>
              </SectionCard>
              <SectionCard title="Operational note">
                <p>Due to the free tier, outbound calls work fine, but inbound testing requires an international verified number. Both inbound and outbound numbers must be verified on Twilio first.</p>
              </SectionCard>
            </div>
          </div>
        );

      case "readme":
        return (
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-blue-50 to-emerald-50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <BookOpen className="size-6 text-emerald-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Aarogya clinic project documentation</h2>
                  <p className="text-sm text-gray-600">This page captures the architecture, integrations, deployment workflow, and operational boundaries of the receptionist platform.</p>
                </div>
              </div>
            </div>

            <DiagramCard title="System architecture" caption="Layered view from caller through telephony, application and data.">
              <SystemArchitectureDiagram />
            </DiagramCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Overview">
                <p>This solution combines a Bolna voice agent, a FastAPI backend, a React operations dashboard, Supabase Postgres, and Cliniko write-back to create a complete clinic receptionist experience.</p>
              </SectionCard>
              <SectionCard title="System components">
                <ul className="list-disc space-y-1 pl-5">
                  <li>FastAPI backend for tools and webhooks</li>
                  <li>React dashboard for clinic operations</li>
                  <li>Bolna voice receptionist integration</li>
                  <li>Supabase and Cliniko connectivity</li>
                </ul>
              </SectionCard>
              <SectionCard title="Operational capabilities">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Appointment booking, rescheduling, and cancellation</li>
                  <li>Returning patient recognition and new patient registration</li>
                  <li>Live availability lookup and slot confirmation</li>
                  <li>Follow-up logging and resume-on-callback support</li>
                </ul>
              </SectionCard>
              <SectionCard title="Deployment and telephony">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Backend should be deployed to a persistent Python host</li>
                  <li>Frontend should be deployed to a static host such as Vercel</li>
                  <li>Twilio numbers must be verified for both inbound and outbound testing</li>
                </ul>
              </SectionCard>
              <SectionCard title="Known limitations">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Free-tier constraints limit concurrency and outbound reach</li>
                  <li>Cliniko trial cannot create practitioners via API</li>
                  <li>Tool webhooks rely on a shared secret rather than full auth</li>
                </ul>
              </SectionCard>
              <SectionCard title="Reference links">
                <ul className="list-disc space-y-1 pl-5">
                  <li><a className="text-blue-600 hover:underline" href="#" onClick={() => setActiveTab("system-prompt")}>Open the enterprise system prompt</a></li>
                  <li><a className="text-blue-600 hover:underline" href="#" onClick={() => setActiveTab("overview")}>Open the full documentation page</a></li>
                </ul>
              </SectionCard>
            </div>

            <DiagramCard title="Data model (ER diagram)" caption="Supabase Postgres schema — source of truth for scheduling, patients and call state.">
              <ErDiagram />
            </DiagramCard>

            <DiagramCard title="Deployment topology" caption="Where each piece runs: static frontend host, persistent Python backend, and managed third-party services.">
              <DeploymentDiagram />
            </DiagramCard>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">Documentation</div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
}

export function SystemPromptPage({ onBack }: DocumentationPageProps) {
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">System Prompt</div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <TerminalSquare className="size-6 text-blue-300" />
          <div>
            <h2 className="text-xl font-semibold">Enterprise voice agent documentation</h2>
            <p className="text-sm text-slate-300">Operational standards, workflow logic, and deployment notes for the Aarogya receptionist.</p>
          </div>
        </div>
      </div>

      <DiagramCard title="Call handling flowchart" caption="Decision logic the agent follows on every call, including the shared-line and interruption-recovery branches.">
        <CallFlowchartDiagram />
      </DiagramCard>

      <DiagramCard title="Booking sequence" caption="Identify → availability → booking → save state → webhook, as message order between systems.">
        <BookingSequenceDiagram />
      </DiagramCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Role definition">
          <p>You are the AI receptionist for Aarogya Multi-Speciality Clinic serving Indiranagar and Whitefield. You handle the full call yourself, support English, Hindi, and Hinglish, and always mirror the caller’s language.</p>
        </SectionCard>
        <SectionCard title="Primary objective">
          <ul className="list-disc space-y-1 pl-5">
            <li>Book, reschedule, and cancel appointments</li>
            <li>Answer branch, hours, and policy questions</li>
            <li>Register new patients and recognize returning patients</li>
            <li>Resume dropped calls and log follow-up requests</li>
          </ul>
        </SectionCard>
        <SectionCard title="Conversation rules">
          <ul className="list-disc space-y-1 pl-5">
            <li>Never ask a question that does not move the booking forward</li>
            <li>Do not ask for information already captured in the current call</li>
            <li>Keep responses short, warm, and professional</li>
          </ul>
        </SectionCard>
        <SectionCard title="Patient identification">
          <ul className="list-disc space-y-1 pl-5">
            <li>Call identify_caller at the beginning of every call</li>
            <li>If the patient is new, collect the full name before booking</li>
            <li>If the line is shared, ask whose appointment it is before proceeding</li>
          </ul>
        </SectionCard>
        <SectionCard title="Availability and booking">
          <ul className="list-disc space-y-1 pl-5">
            <li>Use live availability for every new date or time request</li>
            <li>Never reuse an old availability result</li>
            <li>Confirm doctor, branch, time, and verbal agreement before booking</li>
          </ul>
        </SectionCard>
        <SectionCard title="Operational note">
          <p>Due to the free tier, outbound calls work fine, but inbound testing requires an international verified number. Both inbound and outbound numbers must be verified on Twilio first.</p>
        </SectionCard>
      </div>
    </div>
  );
}

export function ReadmePage({ onBack }: DocumentationPageProps) {
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">Project Docs</div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-blue-50 to-emerald-50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <BookOpen className="size-6 text-emerald-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Aarogya clinic project documentation</h2>
            <p className="text-sm text-gray-600">This page captures the architecture, integrations, deployment workflow, and operational boundaries of the receptionist platform.</p>
          </div>
        </div>
      </div>

      <DiagramCard title="System architecture" caption="Layered view from caller through telephony, application and data.">
        <SystemArchitectureDiagram />
      </DiagramCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Overview">
          <p>This solution combines a Bolna voice agent, a FastAPI backend, a React operations dashboard, Supabase Postgres, and Cliniko write-back to create a complete clinic receptionist experience.</p>
        </SectionCard>
        <SectionCard title="System components">
          <ul className="list-disc space-y-1 pl-5">
            <li>FastAPI backend for tools and webhooks</li>
            <li>React dashboard for clinic operations</li>
            <li>Bolna voice receptionist integration</li>
            <li>Supabase and Cliniko connectivity</li>
          </ul>
        </SectionCard>
        <SectionCard title="Operational capabilities">
          <ul className="list-disc space-y-1 pl-5">
            <li>Appointment booking, rescheduling, and cancellation</li>
            <li>Returning patient recognition and new patient registration</li>
            <li>Live availability lookup and slot confirmation</li>
            <li>Follow-up logging and resume-on-callback support</li>
          </ul>
        </SectionCard>
        <SectionCard title="Deployment and telephony">
          <ul className="list-disc space-y-1 pl-5">
            <li>Backend should be deployed to a persistent Python host</li>
            <li>Frontend should be deployed to a static host such as Vercel</li>
            <li>Twilio numbers must be verified for both inbound and outbound testing</li>
          </ul>
        </SectionCard>
        <SectionCard title="Known limitations">
          <ul className="list-disc space-y-1 pl-5">
            <li>Free-tier constraints limit concurrency and outbound reach</li>
            <li>Cliniko trial cannot create practitioners via API</li>
            <li>Tool webhooks rely on a shared secret rather than full auth</li>
          </ul>
        </SectionCard>
        <SectionCard title="Reference links">
          <ul className="list-disc space-y-1 pl-5">
            <li><a className="text-blue-600 hover:underline" href="/system-prompt">Open the enterprise system prompt</a></li>
            <li><a className="text-blue-600 hover:underline" href="/documentation">Open the full documentation page</a></li>
            <li><a className="text-blue-600 hover:underline" href="/getting-started">Getting started guide</a></li>
            <li><a className="text-blue-600 hover:underline" href="/api-docs">API documentation</a></li>
            <li><a className="text-blue-600 hover:underline" href="/component-docs">Component documentation</a></li>
          </ul>
        </SectionCard>
      </div>

      <DiagramCard title="Data model (ER diagram)" caption="Supabase Postgres schema — source of truth for scheduling, patients and call state.">
        <ErDiagram />
      </DiagramCard>

      <DiagramCard title="Deployment topology" caption="Where each piece runs: static frontend host, persistent Python backend, and managed third-party services.">
        <DeploymentDiagram />
      </DiagramCard>
    </div>
  );
}

export function FullDocumentationPage({ onBack }: DocumentationPageProps) {
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">Full Documentation</div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Workflow className="size-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Architecture and implementation guide</h2>
            <p className="text-sm text-gray-600">A condensed version of the repository README, adapted for the frontend experience.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <SectionCard title="Architecture">
            <p>Caller → Bolna → FastAPI tools → Supabase/Cliniko. Bolna owns the live call, the backend exposes tool webhooks and business logic, and the dashboard is optional for operations.</p>
          </SectionCard>
          <SectionCard title="Why Bolna">
            <ul className="list-disc space-y-1 pl-5">
              <li>Inbound + tool-calling fits live phone support</li>
              <li>Small strongly-typed tools improves reliability</li>
              <li>Multilingual call handling works natively at the provider layer</li>
            </ul>
          </SectionCard>
          <SectionCard title="Backend capabilities">
            <ul className="list-disc space-y-1 pl-5">
              <li>Live availability engine based on working hours and bookings</li>
              <li>Double-booking prevention through database constraints</li>
              <li>Cliniko write-back and reconcile worker support</li>
            </ul>
          </SectionCard>
          <SectionCard title="Ops dashboard">
            <ul className="list-disc space-y-1 pl-5">
              <li>Overview, appointments, patients, sessions, follow-ups</li>
              <li>Inbound/outbound call visibility</li>
              <li>Read-only data views plus explicit operational actions</li>
            </ul>
          </SectionCard>
        </div>
      </div>

      <DiagramCard title="System architecture" caption="Layered view from caller through telephony, application and data.">
        <SystemArchitectureDiagram />
      </DiagramCard>

      <DiagramCard title="Call handling flowchart" caption="Decision logic from connection through identification, intent routing and interruption recovery.">
        <CallFlowchartDiagram />
      </DiagramCard>

      <DiagramCard title="Booking sequence" caption="Message order between caller, Bolna, FastAPI, Postgres and Cliniko for a single booking.">
        <BookingSequenceDiagram />
      </DiagramCard>

      <DiagramCard title="Data model (ER diagram)" caption="Supabase Postgres schema — source of truth for scheduling, patients and call state.">
        <ErDiagram />
      </DiagramCard>
    </div>
  );
}

export function GettingStartedPage({ onBack }: DocumentationPageProps) {
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">Getting Started</div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Rocket className="size-6 text-green-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Getting Started Guide</h2>
            <p className="text-sm text-gray-600">Comprehensive setup guide for new developers to get the Aarogya Clinic system running.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Prerequisites">
          <ul className="list-disc space-y-1 pl-5">
            <li>Node.js (v18 or higher)</li>
            <li>Python (v3.9 or higher)</li>
            <li>Git</li>
            <li>Supabase account (free tier)</li>
            <li>Cliniko account (trial)</li>
            <li>Bolna account (trial)</li>
            <li>Twilio account (trial)</li>
          </ul>
        </SectionCard>
        <SectionCard title="Quick Setup">
          <ul className="list-disc space-y-1 pl-5">
            <li>Clone the repository</li>
            <li>Setup backend (install dependencies, configure .env)</li>
            <li>Apply database migrations</li>
            <li>Seed Cliniko and Supabase</li>
            <li>Start backend server</li>
            <li>Setup frontend and start dev server</li>
          </ul>
        </SectionCard>
        <SectionCard title="Development Workflow">
          <ul className="list-disc space-y-1 pl-5">
            <li>Backend changes require server restart</li>
            <li>Frontend hot-reloads automatically</li>
            <li>Run eval harness for testing</li>
            <li>Use ngrok for local telephony testing</li>
          </ul>
        </SectionCard>
        <SectionCard title="Key Components">
          <ul className="list-disc space-y-1 pl-5">
            <li>Bolna Voice Platform - handles calls and speech</li>
            <li>FastAPI Backend - business logic and tools</li>
            <li>Supabase Database - scheduling and state</li>
            <li>Cliniko PMS - system of record</li>
            <li>React Dashboard - operations interface</li>
          </ul>
        </SectionCard>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Quick Start Commands</h3>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Backend Setup</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
              <code>cd backend
pip install -r requirements.txt
python -m db.apply
python -m seed.seed_cliniko --apply
python -m db.seed_supabase
python run.py</code>
            </pre>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Frontend Setup</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
              <code>cd frontend
npm install
npm run dev</code>
            </pre>
          </div>
        </div>
      </div>

      <DiagramCard title="Deployment topology" caption="Where each piece runs: static frontend host, persistent Python backend, and managed third-party services.">
        <DeploymentDiagram />
      </DiagramCard>
    </div>
  );
}

export function ApiDocumentationPage({ onBack }: DocumentationPageProps) {
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">API Documentation</div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Code className="size-6 text-purple-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">API Reference</h2>
            <p className="text-sm text-gray-600">Complete API documentation for all backend endpoints and tool integrations.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Tool Endpoints (Bolna Agent)">
          <ul className="list-disc space-y-1 pl-5">
            <li>identify_caller - Patient identification</li>
            <li>create_patient - New patient registration</li>
            <li>get_doctors - Doctor listings</li>
            <li>get_branch_info - Branch information</li>
            <li>find_availability - Slot search</li>
            <li>get_earliest_slot - Earliest availability</li>
            <li>book_appointment - Booking confirmation</li>
            <li>get_patient_appointments - Appointment lookup</li>
            <li>reschedule_appointment - Rescheduling</li>
            <li>cancel_appointment - Cancellation</li>
            <li>log_followup - Escalation logging</li>
            <li>save_session_state - State persistence</li>
          </ul>
        </SectionCard>
        <SectionCard title="Dashboard API Endpoints">
          <ul className="list-disc space-y-1 pl-5">
            <li>/api/dashboard/summary - KPI summary</li>
            <li>/api/dashboard/clinic - Branches, doctors, appointment types</li>
            <li>/api/dashboard/appointments - Appointment list</li>
            <li>/api/dashboard/calendar - Calendar grid data</li>
            <li>/api/dashboard/patients - Patient registry</li>
            <li>/api/dashboard/outbound - Outbound call queue</li>
            <li>/api/dashboard/followups (+ /{"{"}id{"}"}/resolve) - Escalation tracking</li>
            <li>/api/dashboard/sessions - Call session debugging</li>
            <li>/api/dashboard/inbound (+ /{"{"}session_id{"}"}) - Inbound call detail</li>
            <li>/api/dashboard/cliniko, /bolna - Integration status</li>
            <li>/api/dashboard/availability - Live availability check</li>
            <li>/health - System health check (no /api prefix)</li>
          </ul>
        </SectionCard>
        <SectionCard title="Authentication">
          <ul className="list-disc space-y-1 pl-5">
            <li>Tool endpoints use X-Tool-Secret header</li>
            <li>Dashboard endpoints currently have no auth</li>
            <li>CORS configured via ALLOWED_ORIGINS</li>
            <li>Shared secret for single-tenant demo</li>
          </ul>
        </SectionCard>
        <SectionCard title="Base URL Configuration">
          <ul className="list-disc space-y-1 pl-5">
            <li>Local: http://localhost:8080</li>
            <li>Production: Deployed backend URL</li>
            <li>Frontend: VITE_API_BASE_URL env var</li>
            <li>Vite proxy handles local development</li>
          </ul>
        </SectionCard>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Error Handling</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="font-medium text-red-800">400 Bad Request</p>
            <p className="text-sm text-red-600 mt-1">Invalid request parameters</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="font-medium text-yellow-800">401 Unauthorized</p>
            <p className="text-sm text-yellow-600 mt-1">Missing or invalid authentication</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="font-medium text-orange-800">409 Conflict</p>
            <p className="text-sm text-orange-600 mt-1">Resource conflict (double booking)</p>
          </div>
        </div>
      </div>

      <DiagramCard title="Tool-call booking sequence" caption="How a Bolna tool call travels through FastAPI to Postgres and, asynchronously, to Cliniko.">
        <BookingSequenceDiagram />
      </DiagramCard>

      <DiagramCard title="Outbound call state machine" caption="/outbound/enqueue and /outbound/process retry logic, keyed by outbound_calls.status.">
        <OutboundStateDiagram />
      </DiagramCard>
    </div>
  );
}

export function ComponentDocumentationPage({ onBack }: DocumentationPageProps) {
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700">Component Documentation</div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Layout className="size-6 text-orange-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">React Component Guide</h2>
            <p className="text-sm text-gray-600">Documentation for all React components used in the Aarogya Clinic dashboard.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Base UI Components">
          <ul className="list-disc space-y-1 pl-5">
            <li>Button - Various styles and sizes</li>
            <li>Card - Content containers</li>
            <li>Input - Text input with validation</li>
            <li>Select - Dropdown component</li>
            <li>Dialog - Modal dialogs</li>
            <li>Badge - Status indicators</li>
            <li>Table - Data tables</li>
            <li>Label - Form labels</li>
            <li>Textarea - Multi-line input</li>
          </ul>
        </SectionCard>
        <SectionCard title="Feature Components">
          <ul className="list-disc space-y-1 pl-5">
            <li>Dashboard - KPIs and quick actions</li>
            <li>Calendar - Cliniko-style grid view</li>
            <li>InboundCalls - Call monitoring</li>
            <li>Appointments - Appointment management</li>
            <li>Patients - Patient registry</li>
            <li>Outbound - Outbound call queue</li>
            <li>Followups - Escalation tracking</li>
            <li>Sessions - Call session debugging</li>
          </ul>
        </SectionCard>
        <SectionCard title="Component Patterns">
          <ul className="list-disc space-y-1 pl-5">
            <li>Loading pattern with StateBlock</li>
            <li>Error handling with retry</li>
            <li>Navigation via callback props</li>
            <li>Data fetching from API client</li>
            <li>Auto-refresh with useEffect</li>
          </ul>
        </SectionCard>
        <SectionCard title="Styling Guidelines">
          <ul className="list-disc space-y-1 pl-5">
            <li>Tailwind CSS utility classes</li>
            <li>Consistent spacing system</li>
            <li>Color palette for semantic meaning</li>
            <li>Responsive design patterns</li>
            <li>Gradient usage for emphasis</li>
          </ul>
        </SectionCard>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Component Architecture</h3>
        <div className="mt-4 text-sm text-gray-700">
          <p className="mb-2">Components are organized by feature domain in <code className="bg-gray-100 px-2 py-1 rounded">src/app/components/</code>:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>ui/</strong> - Reusable base components (Button, Card, Input, etc.)</li>
            <li><strong>Dashboard.tsx</strong> - Main dashboard with KPIs and quick actions</li>
            <li><strong>Calendar.tsx</strong> - Appointment calendar grid</li>
            <li><strong>*Calls.tsx</strong> - Call management components</li>
            <li><strong>Patients.tsx</strong> - Patient management</li>
            <li><strong>Sidebar.tsx</strong> - Navigation sidebar</li>
          </ul>
        </div>
      </div>

      <DiagramCard title="Component tree" caption="How App.tsx routes into the sidebar-driven feature views, on top of the shared ui/ primitives and api.ts client.">
        <ComponentTreeDiagram />
      </DiagramCard>
    </div>
  );
}
