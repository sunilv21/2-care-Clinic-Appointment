"""app/main.py — FastAPI tool-webhook API the Bolna agent calls mid-conversation.

Endpoints are small, strongly-typed, and return compact JSON the LLM can speak back. Supabase is the
source of truth; Cliniko write-back is queued to pms_outbox.

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Union

from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from app import config, tools, outbound, dashboard
from app.availability import find_availability
from app.pms_writeback import drain_once

ROOT = Path(__file__).resolve().parent.parent          # backend/
REPO_ROOT = ROOT.parent                                 # repo root (backend/ and frontend/ are siblings)
REACT_DIST = REPO_ROOT / "frontend" / "dist"            # built clinic dashboard UI (separate deploy target)
STATIC_DIR = Path(__file__).resolve().parent / "static"  # plain HTML fallback

app = FastAPI(title="Aarogya Clinic — Voice Agent Tools", version="1.0")

# CORS: needed when the dashboard is hosted separately (e.g. Vercel) from this backend
# (e.g. Railway/Render). ALLOWED_ORIGINS is a comma-separated list; "*" allows any origin
# (fine for read-mostly dashboard endpoints with no cookie-based auth — no credentials are sent).
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── auth (shared secret; skipped if TOOL_WEBHOOK_SECRET unset) ───────────────
def require_secret(x_tool_secret: Optional[str] = Header(default=None)):
    if config.TOOL_WEBHOOK_SECRET and x_tool_secret != config.TOOL_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="bad tool secret")


# ── request models ───────────────────────────────────────────────────────────
class IdentifyReq(BaseModel):
    phone: str
    spoken_name: Optional[str] = None


class CreatePatientReq(BaseModel):
    full_name: str
    phone: str

    @model_validator(mode="before")
    @classmethod
    def accept_bolna_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        values = dict(data)
        if not values.get("full_name"):
            values["full_name"] = (
                values.get("patient_name")
                or values.get("name")
                or values.get("caller_name")
            )
        if not values.get("phone"):
            values["phone"] = (
                values.get("phone_number")
                or values.get("caller_phone")
                or values.get("from")
            )
        return values


class DoctorsReq(BaseModel):
    branch: Optional[str] = None
    specialty: Optional[str] = None


class BranchInfoReq(BaseModel):
    pass


class EarliestSlotReq(BaseModel):
    specialty: Optional[str] = None
    branch: Optional[str] = None
    appointment_type: str = "consult"


class PatientAppointmentsReq(BaseModel):
    phone: Optional[str] = None
    patient_id: Optional[str] = None


class AvailabilityReq(BaseModel):
    appointment_type: str = "consult"
    branch: Optional[str] = None
    practitioner: Optional[str] = None
    specialty: Optional[str] = None
    date: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    time_from: Optional[str] = None
    time_to: Optional[str] = None
    # Bolna's custom_task tools substitute ALL params as strings (%(name)s) — accept either the
    # native type (our own dashboard sends real bool/int) or a string (Bolna), and let
    # tools.availability() coerce strings defensively.
    earliest_across_all: Union[bool, str] = False
    limit: Union[int, str] = 5


class BookReq(BaseModel):
    patient_name: str
    phone: str
    practitioner_id: str
    branch_id: str
    start_iso: str
    appointment_type_id: str = "consult"
    idempotency_key: Optional[str] = None


class RescheduleReq(BaseModel):
    appointment_id: str
    new_start_iso: str
    idempotency_key: Optional[str] = None


class CancelReq(BaseModel):
    appointment_id: str


class FollowupReq(BaseModel):
    reason: str
    phone: Optional[str] = None
    patient_id: Optional[str] = None
    notes: Optional[str] = None
    transcript_ref: Optional[str] = None


class SessionReq(BaseModel):
    phone: str
    # Bolna sends this as a JSON-encoded STRING (custom_task params are string-substituted);
    # our own dashboard/tests may send a real dict. tools.save_session_state() accepts either.
    context: Any = {}
    state: str = "active"
    bolna_execution_id: Optional[str] = None
    direction: str = "inbound"


class CallEndReq(BaseModel):
    phone: Optional[str] = None
    status: Optional[str] = None
    direction: str = "inbound"
    transcript: Any = None
    bolna_execution_id: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def accept_bolna_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        values = dict(data)
        if not values.get("phone"):
            values["phone"] = (
                values.get("phone_number")
                or values.get("caller_phone")
                or values.get("from")
            )
        if not values.get("status"):
            values["status"] = values.get("call_status") or values.get("call_state")
        if not values.get("bolna_execution_id"):
            values["bolna_execution_id"] = values.get("execution_id") or values.get("call_id")
        if not values.get("direction"):
            values["direction"] = values.get("call_direction") or "inbound"
        return values


# ── routes ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True, "clinic": config.CLINIC_NAME, "tz": config.TIME_ZONE}


# ── frontend dashboard (read-only API + built React UI) ──────────────────────
if (REACT_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(REACT_DIST / "assets")), name="assets")


@app.get("/")
def dashboard_page():
    react_idx = REACT_DIST / "index.html"
    if react_idx.exists():
        return FileResponse(str(react_idx))
    idx = STATIC_DIR / "index.html"
    if idx.exists():
        return FileResponse(str(idx))
    return {"ok": True, "message": "dashboard not built; API is at /api/dashboard/*"}


@app.get("/system-prompt")
def system_prompt_page():
    page = STATIC_DIR / "system_prompt.html"
    if page.exists():
        return FileResponse(str(page))
    raise HTTPException(status_code=404, detail="page not found")


@app.get("/readme")
def readme_page():
    page = STATIC_DIR / "readme.html"
    if page.exists():
        return FileResponse(str(page))
    raise HTTPException(status_code=404, detail="page not found")


@app.get("/documentation")
def documentation_page():
    page = STATIC_DIR / "documentation.html"
    if page.exists():
        return FileResponse(str(page))
    raise HTTPException(status_code=404, detail="page not found")


@app.get("/api/dashboard/summary")
def d_summary():
    return dashboard.summary()


@app.get("/api/dashboard/clinic")
def d_clinic():
    return dashboard.clinic()


@app.get("/api/dashboard/appointments")
def d_appointments():
    return {"rows": dashboard.appointments()}


@app.get("/api/dashboard/calendar")
def d_calendar(date_from: str, date_to: str):
    return dashboard.calendar(date_from, date_to)


@app.get("/api/dashboard/patients")
def d_patients():
    return {"rows": dashboard.patients()}


@app.get("/api/dashboard/outbound")
def d_outbound():
    return {"rows": dashboard.outbound()}


@app.get("/api/dashboard/followups")
def d_followups():
    return {"rows": dashboard.followups()}


@app.get("/api/dashboard/sessions")
def d_sessions():
    return {"rows": dashboard.sessions()}


@app.get("/api/dashboard/inbound")
def d_inbound():
    return {"rows": dashboard.inbound_calls()}


@app.get("/api/dashboard/inbound/{session_id}")
def d_inbound_detail(session_id: str):
    row = dashboard.session_detail(session_id)
    if not row:
        raise HTTPException(status_code=404, detail="call not found")
    return row


@app.post("/api/dashboard/followups/{followup_id}/resolve")
def d_resolve_followup(followup_id: str):
    return dashboard.resolve_followup(followup_id)


@app.get("/api/dashboard/cliniko")
def d_cliniko():
    return dashboard.cliniko_snapshot()


@app.get("/api/dashboard/bolna")
def d_bolna():
    return dashboard.bolna_snapshot()


@app.get("/api/dashboard/availability")
def d_availability(specialty: str | None = None, branch: str | None = None,
                   earliest_across_all: bool = True, limit: int = 8):
    return {"slots": find_availability(specialty=specialty, branch=branch,
                                       earliest_across_all=earliest_across_all, limit=limit)}


@app.post("/tools/identify_caller", dependencies=[Depends(require_secret)])
def r_identify(req: IdentifyReq):
    return tools.identify_caller(req.phone, req.spoken_name)


@app.post("/tools/create_patient", dependencies=[Depends(require_secret)])
def r_create_patient(req: CreatePatientReq):
    return tools.create_patient(**req.model_dump())


@app.post("/tools/get_doctors", dependencies=[Depends(require_secret)])
def r_get_doctors(req: DoctorsReq):
    return tools.get_doctors(**req.model_dump())


@app.post("/tools/get_branch_info", dependencies=[Depends(require_secret)])
def r_branch_info(req: BranchInfoReq):
    return tools.get_branch_info()


@app.post("/tools/find_availability", dependencies=[Depends(require_secret)])
def r_availability(req: AvailabilityReq):
    return tools.availability(**req.model_dump())


@app.post("/tools/get_earliest_slot", dependencies=[Depends(require_secret)])
def r_earliest_slot(req: EarliestSlotReq):
    return tools.get_earliest_slot(**req.model_dump())


@app.post("/tools/get_patient_appointments", dependencies=[Depends(require_secret)])
def r_patient_appointments(req: PatientAppointmentsReq):
    return tools.get_patient_appointments(**req.model_dump())


@app.post("/tools/book_appointment", dependencies=[Depends(require_secret)])
def r_book(req: BookReq, bg: BackgroundTasks):
    res = tools.book_appointment(**req.model_dump())
    if res.get("ok"):
        bg.add_task(drain_once)   # confirm-then-sync: write back to Cliniko after responding
    return res


@app.post("/tools/reschedule_appointment", dependencies=[Depends(require_secret)])
def r_reschedule(req: RescheduleReq, bg: BackgroundTasks):
    res = tools.reschedule_appointment(**req.model_dump())
    if res.get("ok"):
        bg.add_task(drain_once)
    return res


@app.post("/tools/cancel_appointment", dependencies=[Depends(require_secret)])
def r_cancel(req: CancelReq, bg: BackgroundTasks):
    res = tools.cancel_appointment(**req.model_dump())
    if res.get("ok"):
        bg.add_task(drain_once)
    return res


@app.post("/tools/log_followup", dependencies=[Depends(require_secret)])
def r_followup(req: FollowupReq):
    return tools.log_followup(**req.model_dump())


@app.post("/tools/save_session_state", dependencies=[Depends(require_secret)])
def r_session(req: SessionReq):
    return tools.save_session_state(**req.model_dump())


@app.post("/webhooks/bolna_call_end", dependencies=[Depends(require_secret)])
def r_call_end(req: CallEndReq):
    return tools.finalize_call(**req.model_dump())


# ── outbound calls (retry + continuation) ────────────────────────────────────
class OutboundEnqueueReq(BaseModel):
    phone: str
    purpose: str = "callback"
    patient_id: Optional[str] = None
    session_id: Optional[str] = None
    max_attempts: int = 3
    delay_minutes: int = 0


class OutboundStatusReq(BaseModel):
    execution_id: str
    status: str


@app.post("/outbound/enqueue")
def r_outbound_enqueue(req: OutboundEnqueueReq):
    return outbound.enqueue_call(**req.model_dump())


@app.post("/outbound/process")
def r_outbound_process():
    return outbound.process_due()


@app.post("/webhooks/bolna_outbound_status", dependencies=[Depends(require_secret)])
def r_outbound_status(req: OutboundStatusReq):
    return outbound.handle_status(**req.model_dump())
