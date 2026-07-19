import { ArrowLeft, BookOpen, TerminalSquare } from "lucide-react";

interface DocumentationPageProps {
  onBack: () => void;
}

export function SystemPromptPage({ onBack }: DocumentationPageProps) {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">System Prompt</div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <TerminalSquare className="size-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">System prompt & tool setup</h2>
            <p className="text-sm text-gray-500">Configuration details for the Bolna voice receptionist.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm text-gray-700">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Endpoints</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><span className="font-medium">Base URL:</span> https://two-care-clinic-appointment.onrender.com</li>
              <li><span className="font-medium">Webhook:</span> https://two-care-clinic-appointment.onrender.com/webhooks/bolna_call_end</li>
              <li><span className="font-medium">Tools:</span> https://two-care-clinic-appointment.onrender.com/tools/&lt;tool-name&gt;</li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Prompt summary</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
Greet the caller warmly and confirm the clinic.
Always call identify_caller first with the caller phone number.
Use tools for live patient, doctor, availability, booking, reschedule, cancel, and follow-up actions.
Never answer live scheduling questions from memory.
If the call drops, preserve context and resume on callback.
            </pre>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="font-semibold">Calling note</p>
            <p className="mt-1">Due to the free tier, outbound calls are working fine. For inbound calls, we need to call on the international number, not +19158000106. For both outbound and inbound calls, the numbers must be verified on Twilio first.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReadmePage({ onBack }: DocumentationPageProps) {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-blue-500">
          <ArrowLeft className="size-4" /> Back to dashboard
        </button>
        <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">README</div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <BookOpen className="size-6 text-emerald-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">README & documentation</h2>
            <p className="text-sm text-gray-500">Project guidance and operational references.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm text-gray-700">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Reference links</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><a className="text-blue-600 hover:underline" href="https://github.com" target="_blank" rel="noreferrer">Prompt documentation link</a></li>
              <li><a className="text-blue-600 hover:underline" href="https://github.com" target="_blank" rel="noreferrer">README / Notion / Google Doc link</a></li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">This project includes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>FastAPI backend for tools and webhooks</li>
              <li>React dashboard for clinic operations</li>
              <li>Bolna voice receptionist integration</li>
              <li>Supabase and Cliniko connectivity</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
