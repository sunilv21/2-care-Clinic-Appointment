/**
 * api.ts — API layer for the Aarogya Clinic ops dashboard.
 * Targets the FastAPI clinic backend (backend/app/main.py).
 *
 * - Local dev (npm run dev): VITE_API_BASE_URL unset -> BASE="" -> relative paths -> Vite's dev
 *   proxy (see vite.config.ts) forwards them to the backend on localhost:8080.
 * - Split deployment (this dashboard on Vercel, backend on Railway/Render/etc.): set
 *   VITE_API_BASE_URL to the backend's public URL at build time -> every call goes there directly.
 *   The backend must have CORS configured to allow this dashboard's origin (see backend's
 *   ALLOWED_ORIGINS env var).
 * - Single-host deployment (backend also serves this dashboard's build): leave unset -> relative
 *   paths -> same-origin, no CORS needed at all.
 */

const BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";
const DEFAULT_TIMEOUT_MS = 30000;

async function apiFetch<T = any>(url: string, opts?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts?.headers as any) };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(`${BASE}${url}`, {
      method: opts?.method || "GET",
      body: opts?.body,
      headers,
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`${resp.status}: ${text}`);
    }
    return (await resp.json()) as T;
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error("Request timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── System ─────────────────────────────────
export const getHealth = () => apiFetch<{ ok: boolean; clinic: string; tz: string }>(`/health`);

// ─── Dashboard (read-only) ──────────────────
export const getSummary = () => apiFetch<Record<string, number>>(`/api/dashboard/summary`);
export const getClinic = () =>
  apiFetch<{ branches: any[]; doctors: any[]; appointment_types: any[] }>(`/api/dashboard/clinic`);
export const getCliniko = () => apiFetch<any>(`/api/dashboard/cliniko`);
export const getBolna = () => apiFetch<any>(`/api/dashboard/bolna`);
export const getAppointments = () => apiFetch<{ rows: any[] }>(`/api/dashboard/appointments`);
export const getCalendar = (dateFrom: string, dateTo: string) =>
  apiFetch<{ events: any[]; doctors: any[] }>(
    `/api/dashboard/calendar?date_from=${dateFrom}&date_to=${dateTo}`);
export const getPatients = () => apiFetch<{ rows: any[] }>(`/api/dashboard/patients`);
export const getOutbound = () => apiFetch<{ rows: any[] }>(`/api/dashboard/outbound`);
export const getFollowups = () => apiFetch<{ rows: any[] }>(`/api/dashboard/followups`);
export const getSessions = () => apiFetch<{ rows: any[] }>(`/api/dashboard/sessions`);
export const getInboundCalls = () => apiFetch<{ rows: any[] }>(`/api/dashboard/inbound`);
export const getInboundDetail = (id: string) => apiFetch<any>(`/api/dashboard/inbound/${id}`);

export const resolveFollowup = (id: string) =>
  apiFetch(`/api/dashboard/followups/${id}/resolve`, { method: "POST" });

export const getAvailability = (p: { specialty?: string; branch?: string; limit?: number }) => {
  const q = new URLSearchParams({
    specialty: p.specialty || "",
    branch: p.branch || "",
    earliest_across_all: "true",
    limit: String(p.limit ?? 8),
  });
  return apiFetch<{ slots: any[] }>(`/api/dashboard/availability?${q}`);
};

// ─── Outbound controls ──────────────────────
export const enqueueOutbound = (phone: string, purpose: string, sessionId?: string) =>
  apiFetch(`/outbound/enqueue`, {
    method: "POST",
    body: JSON.stringify({ phone, purpose, session_id: sessionId }),
  });

export const processOutbound = () => apiFetch(`/outbound/process`, { method: "POST" });
