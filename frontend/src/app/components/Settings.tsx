import { useState, useEffect, useCallback } from "react";
import { getAgentConfig, updateAgentConfig } from "../api";
import {
  Save, Loader2, AlertCircle, CheckCircle2, Bot,
} from "lucide-react";

interface AgentConfigState {
  agentName: string;
}

const DEFAULT_CONFIG: AgentConfigState = {
  agentName: "Neha",
};

function dbRowToState(row: any): AgentConfigState {
  return {
    agentName: row.agent_name ?? DEFAULT_CONFIG.agentName,
  };
}

export function Settings() {
  const [config, setConfig] = useState<AgentConfigState>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const resp = await getAgentConfig();
        if (resp.config) setConfig(dbRowToState(resp.config));
      } catch (e: any) {
        setError(e.message || "Failed to load config");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = useCallback((fn: (prev: AgentConfigState) => AgentConfigState) => {
    setConfig((prev) => fn(prev));
    setDirty(true);
    setSaved(false);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await updateAgentConfig({
        agentName: config.agentName,
      });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="size-6 animate-spin mr-2" /> Loading configuration…
      </div>
    );
  }

  const inputCls =
    "w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Agent Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Opener, knowledge base, LLM, STT, TTS, and system prompt are all managed in the Bolna dashboard.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            saving
              ? "bg-gray-100 text-gray-400 cursor-wait"
              : saved
              ? "bg-green-50 text-green-700 border border-green-200"
              : dirty
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
          {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Bot className="size-[18px] text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Agent Identity</h3>
              <p className="text-xs text-gray-500 mt-0.5">Name used as metadata when placing calls via Bolna.</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Agent Name</label>
            <input
              type="text"
              value={config.agentName}
              onChange={(e) => update((c) => ({ ...c, agentName: e.target.value }))}
              placeholder="e.g. Neha, Priya, Sarah"
              className={inputCls}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Sent as <code className="bg-gray-100 px-1 rounded">{"{agent_name}"}</code> in call metadata to Bolna.
            </p>
          </div>
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
