# API Documentation

Complete API reference for the Aarogya Clinic system. This documentation covers all endpoints available to the frontend dashboard and external integrations.

## � Base URL

The API base URL is configured via environment variable:

- **Local Development**: `http://localhost:8080`
- **Production**: Your deployed backend URL (e.g., `https://your-backend.up.railway.app`)

For frontend development with Vite, API calls are proxied to the backend automatically. For split deployments, set `VITE_API_BASE_URL` in the frontend environment.

## �🔒 Authentication

### Tool Webhook Authentication

Tool endpoints (used by Bolna agent) require authentication via a shared secret header:

```http
X-Tool-Secret: your_tool_webhook_secret
```

This secret must match the `TOOL_WEBHOOK_SECRET` environment variable configured in the backend.

### Dashboard API Authentication

Dashboard endpoints currently do not require authentication (read-mostly ops tool). This is acceptable for single-tenant deployments but should be enhanced with proper authentication for production use.

## 📡 Base URL

The API base URL is configured via environment variable:

- **Local Development**: `http://localhost:8080`
- **Production**: Your deployed backend URL (e.g., `https://your-backend.up.railway.app`)

For frontend development with Vite, API calls are proxied to the backend automatically. For split deployments, set `VITE_API_BASE_URL` in the frontend environment.

## 🛠 Tool Endpoints (Bolna Agent)

These endpoints are called by the Bolna voice agent during phone conversations.

### POST /tools/identify_caller

Identifies a caller by phone number and returns patient information and call context.

**Request:**
```json
{
  "phone": "+919876543210"
}
```

**Response:**
```json
{
  "patients": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "phone": "+919876543210",
      "dob": "1990-01-15",
      "notes": "Regular patient",
      "cliniko_patient_id": 12345
    }
  ],
  "open_session": {
    "id": "uuid",
    "state": "active",
    "context_json": {},
    "last_turn_at": "2024-01-15T10:30:00Z"
  },
  "dropped_call": false,
  "callback": false,
  "resume_context": null
}
```

**Use Cases:**
- Patient identification at call start
- Detecting returning patients
- Identifying family line (multiple patients on same phone)
- Resuming dropped calls

---

### POST /tools/create_patient

Registers a new patient in the system.

**Request:**
```json
{
  "full_name": "Jane Smith",
  "phone": "+919876543211",
  "dob": "1985-05-20",
  "notes": "New patient"
}
```

**Response:**
```json
{
  "id": "uuid",
  "full_name": "Jane Smith",
  "phone": "+919876543211",
  "dob": "1985-05-20",
  "notes": "New patient",
  "cliniko_patient_id": 12346,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Use Cases:**
- New patient registration
- Patient data updates

---

### POST /tools/get_doctors

Lists available doctors, optionally filtered by specialty or branch.

**Request:**
```json
{
  "specialty": "Dermatology",
  "branch_id": "uuid"
}
```

**Response:**
```json
{
  "doctors": [
    {
      "id": "uuid",
      "full_name": "Dr. Sarah Johnson",
      "specialty": "Dermatology",
      "branches": [
        {
          "branch_id": "uuid",
          "branch_name": "Indiranagar"
        }
      ]
    }
  ]
}
```

**Use Cases:**
- Doctor availability queries
- Specialty-based doctor search
- Branch-specific doctor listings

---

### POST /tools/get_branch_info

Lists clinic branches with address and operating hours.

**Request:**
```json
{}
```

**Response:**
```json
{
  "branches": [
    {
      "id": "uuid",
      "name": "Indiranagar",
      "address": "123 Main Street, Indiranagar",
      "phone": "+919876543212",
      "open_time": "09:00",
      "close_time": "18:00",
      "timezone": "Asia/Kolkata",
      "buffer_minutes": 15
    }
  ]
}
```

**Use Cases:**
- Location information requests
- Operating hours queries
- Branch selection

---

### POST /tools/find_availability

Searches for available appointment slots based on criteria.

**Request:**
```json
{
  "branch_id": "uuid",
  "practitioner_id": "uuid",
  "specialty": "Dermatology",
  "date": "2024-01-20",
  "time_from": "09:00",
  "time_to": "12:00",
  "earliest_across_all": false
}
```

**Response:**
```json
{
  "slots": [
    {
      "practitioner_id": "uuid",
      "practitioner_name": "Dr. Sarah Johnson",
      "branch_id": "uuid",
      "branch_name": "Indiranagar",
      "start": "2024-01-20T09:30:00+05:30",
      "end": "2024-01-20T10:00:00+05:30",
      "local_date": "2024-01-20",
      "local_time": "09:30"
    }
  ]
}
```

**Use Cases:**
- General availability search
- Time-specific slot queries
- Cross-branch availability
- Earliest slot finding

---

### POST /tools/get_earliest_slot

Finds the earliest available slot across all doctors and branches.

**Request:**
```json
{}
```

**Response:**
```json
{
  "slots": [
    {
      "practitioner_id": "uuid",
      "practitioner_name": "Dr. Sarah Johnson",
      "branch_id": "uuid",
      "branch_name": "Indiranagar",
      "start": "2024-01-15T14:00:00+05:30",
      "end": "2024-01-15T14:30:00+05:30",
      "local_date": "2024-01-15",
      "local_time": "14:00"
    }
  ]
}
```

**Use Cases:**
- "Soonest available" requests
- "First available" queries
- Cross-branch earliest search

---

### POST /tools/book_appointment

Books an appointment for a patient.

**Request:**
```json
{
  "patient_id": "uuid",
  "practitioner_id": "uuid",
  "branch_id": "uuid",
  "start_ts": "2024-01-20T09:30:00+05:30",
  "end_ts": "2024-01-20T10:00:00+05:30",
  "idempotency_key": "unique-key-123"
}
```

**Response:**
```json
{
  "ok": true,
  "appointment_id": "uuid",
  "practitioner_name": "Dr. Sarah Johnson",
  "branch_name": "Indiranagar",
  "start": "2024-01-20T09:30:00+05:30",
  "end": "2024-01-20T10:00:00+05:30"
}
```

**Conflict Response:**
```json
{
  "conflict": true,
  "message": "Slot was just booked"
}
```

**Use Cases:**
- Confirming appointments
- Handling booking conflicts
- Idempotent booking operations

---

### POST /tools/get_patient_appointments

Retrieves a patient's existing appointments.

**Request:**
```json
{
  "patient_id": "uuid",
  "include_past": false
}
```

**Response:**
```json
{
  "appointments": [
    {
      "id": "uuid",
      "patient_id": "uuid",
      "practitioner_id": "uuid",
      "practitioner_name": "Dr. Sarah Johnson",
      "branch_id": "uuid",
      "branch_name": "Indiranagar",
      "start_ts": "2024-01-20T09:30:00+05:30",
      "end_ts": "2024-01-20T10:00:00+05:30",
      "status": "booked",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Use Cases:**
- Rescheduling preparation
- Cancellation preparation
- Appointment history

---

### POST /tools/reschedule_appointment

Reschedules an existing appointment to a new time.

**Request:**
```json
{
  "appointment_id": "uuid",
  "new_start_ts": "2024-01-21T10:00:00+05:30",
  "new_end_ts": "2024-01-21T10:30:00+05:30",
  "idempotency_key": "unique-key-456"
}
```

**Response:**
```json
{
  "ok": true,
  "appointment_id": "uuid",
  "new_start": "2024-01-21T10:00:00+05:30",
  "new_end": "2024-01-21T10:30:00+05:30"
}
```

**Fee Response:**
```json
{
  "ok": true,
  "appointment_id": "uuid",
  "fee": {
    "amount": 100,
    "currency": "INR"
  }
}
```

**Use Cases:**
- Appointment rescheduling
- Fee calculation
- Conflict handling

---

### POST /tools/cancel_appointment

Cancels an existing appointment.

**Request:**
```json
{
  "appointment_id": "uuid"
}
```

**Response:**
```json
{
  "ok": true,
  "appointment_id": "uuid"
}
```

**Fee Response:**
```json
{
  "ok": true,
  "appointment_id": "uuid",
  "fee": {
    "amount": 50,
    "currency": "INR"
  }
}
```

**Use Cases:**
- Appointment cancellation
- Fee calculation
- Slot release

---

### POST /tools/log_followup

Logs a follow-up request for human intervention.

**Request:**
```json
{
  "phone": "+919876543210",
  "patient_id": "uuid",
  "reason": "Clinical concern",
  "notes": "Patient reported chest pain"
}
```

**Response:**
```json
{
  "ok": true,
  "followup_id": "uuid",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Use Cases:**
- Human handoff requests
- Clinical concerns
- Out-of-scope issues
- Escalation tracking

---

### POST /tools/save_session_state

Saves the current call session state for recovery.

**Request:**
```json
{
  "phone": "+919876543210",
  "patient_id": "uuid",
  "context": {
    "intent": "booking",
    "requested_specialty": "Dermatology",
    "collected_name": "John Doe"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "session_id": "uuid"
}
```

**Use Cases:**
- Dropped call recovery
- Context preservation
- State tracking

---

## 📊 Dashboard API Endpoints

These endpoints are used by the React dashboard for monitoring and management.

### GET /api/appointments

Lists all appointments with optional filtering.

**Query Parameters:**
- `status`: Filter by status (`booked`, `cancelled`, `completed`)
- `patient_id`: Filter by patient
- `practitioner_id`: Filter by doctor
- `branch_id`: Filter by branch
- `from_date`: Start date filter
- `to_date`: End date filter
- `limit`: Maximum results (default: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "appointments": [
    {
      "id": "uuid",
      "patient_id": "uuid",
      "patient_name": "John Doe",
      "practitioner_id": "uuid",
      "practitioner_name": "Dr. Sarah Johnson",
      "branch_id": "uuid",
      "branch_name": "Indiranagar",
      "start_ts": "2024-01-20T09:30:00+05:30",
      "end_ts": "2024-01-20T10:00:00+05:30",
      "status": "booked",
      "pms_sync_state": "synced",
      "origin": "agent",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0
}
```

---

### GET /api/appointments/:id

Retrieves a specific appointment by ID.

**Response:**
```json
{
  "id": "uuid",
  "patient_id": "uuid",
  "patient_name": "John Doe",
  "practitioner_id": "uuid",
  "practitioner_name": "Dr. Sarah Johnson",
  "branch_id": "uuid",
  "branch_name": "Indiranagar",
  "start_ts": "2024-01-20T09:30:00+05:30",
  "end_ts": "2024-01-20T10:00:00+05:30",
  "status": "booked",
  "pms_sync_state": "synced",
  "cliniko_appointment_id": 789,
  "origin": "agent",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### GET /api/patients

Lists all patients with optional filtering.

**Query Parameters:**
- `search`: Search by name or phone
- `limit`: Maximum results (default: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "patients": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "phone": "+919876543210",
      "dob": "1990-01-15",
      "notes": "Regular patient",
      "cliniko_patient_id": 12345,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 50,
  "limit": 100,
  "offset": 0
}
```

---

### GET /api/patients/:id

Retrieves a specific patient by ID.

**Response:**
```json
{
  "id": "uuid",
  "full_name": "John Doe",
  "phone": "+919876543210",
  "dob": "1990-01-15",
  "notes": "Regular patient",
  "cliniko_patient_id": 12345,
  "created_at": "2024-01-15T10:30:00Z",
  "appointments": []
}
```

---

### GET /api/calls

Lists all call sessions.

**Query Parameters:**
- `direction`: Filter by direction (`in`, `out`)
- `status`: Filter by status (`active`, `completed`, `interrupted`, `callback_pending`)
- `from_date`: Start date filter
- `to_date`: End date filter
- `limit`: Maximum results (default: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "calls": [
    {
      "id": "uuid",
      "phone": "+919876543210",
      "patient_id": "uuid",
      "patient_name": "John Doe",
      "direction": "in",
      "state": "completed",
      "bolna_execution_id": "bolna-id-123",
      "context_json": {},
      "last_turn_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 200,
  "limit": 100,
  "offset": 0
}
```

---

### GET /api/calls/:id/transcript

Retrieves the transcript for a specific call.

**Response:**
```json
{
  "call_id": "uuid",
  "transcript": [
    {
      "speaker": "agent",
      "text": "Hello, thank you for calling Aarogya Clinic.",
      "timestamp": "2024-01-15T10:00:10Z"
    },
    {
      "speaker": "caller",
      "text": "I'd like to book an appointment.",
      "timestamp": "2024-01-15T10:00:15Z"
    }
  ]
}
```

---

### GET /api/availability

Checks availability for a given date/time range.

**Query Parameters:**
- `branch_id`: Filter by branch
- `practitioner_id`: Filter by doctor
- `date`: Specific date (YYYY-MM-DD)
- `from_time`: Start time (HH:MM)
- `to_time`: End time (HH:MM)

**Response:**
```json
{
  "slots": [
    {
      "practitioner_id": "uuid",
      "practitioner_name": "Dr. Sarah Johnson",
      "branch_id": "uuid",
      "branch_name": "Indiranagar",
      "start": "2024-01-20T09:30:00+05:30",
      "end": "2024-01-20T10:00:00+05:30"
    }
  ]
}
```

---

### GET /api/followups

Lists all follow-up requests.

**Query Parameters:**
- `resolved`: Filter by resolution status (`true`, `false`)
- `limit`: Maximum results (default: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "followups": [
    {
      "id": "uuid",
      "phone": "+919876543210",
      "patient_id": "uuid",
      "patient_name": "John Doe",
      "reason": "Clinical concern",
      "notes": "Patient reported chest pain",
      "resolved": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 10,
  "limit": 100,
  "offset": 0
}
```

---

### POST /api/followups/:id/resolve

Marks a follow-up as resolved.

**Response:**
```json
{
  "ok": true,
  "followup_id": "uuid",
  "resolved_at": "2024-01-15T11:00:00Z"
}
```

---

### POST /api/outbound/enqueue

Enqueues an outbound call.

**Request:**
```json
{
  "phone": "+919876543210",
  "patient_id": "uuid",
  "context": {
    "type": "reminder",
    "appointment_id": "uuid"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "outbound_id": "uuid",
  "scheduled_at": "2024-01-15T12:00:00Z"
}
```

---

### GET /api/outbound/queue

Lists the outbound call queue.

**Response:**
```json
{
  "queue": [
    {
      "id": "uuid",
      "phone": "+919876543210",
      "patient_id": "uuid",
      "patient_name": "John Doe",
      "status": "pending",
      "attempts": 0,
      "context": {},
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### GET /api/branches

Lists all clinic branches.

**Response:**
```json
{
  "branches": [
    {
      "id": "uuid",
      "name": "Indiranagar",
      "address": "123 Main Street, Indiranagar",
      "phone": "+919876543212",
      "open_time": "09:00",
      "close_time": "18:00",
      "timezone": "Asia/Kolkata",
      "buffer_minutes": 15,
      "active": true,
      "cliniko_business_id": 456
    }
  ]
}
```

---

### GET /api/practitioners

Lists all practitioners/doctors.

**Response:**
```json
{
  "practitioners": [
    {
      "id": "uuid",
      "full_name": "Dr. Sarah Johnson",
      "specialty": "Dermatology",
      "active": true,
      "cliniko_practitioner_id": 789
    }
  ]
}
```

---

### GET /api/stats

Returns dashboard statistics.

**Response:**
```json
{
  "total_appointments": 150,
  "active_patients": 50,
  "today_appointments": 12,
  "pending_followups": 5,
  "calls_today": 25,
  "avg_call_duration": 180
}
```

---

### GET /api/health

System health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "cliniko": "connected",
  "bolna": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 🔄 Webhook Endpoints

### POST /webhooks/bolna_call_end

Bolna end-of-call webhook for session finalization.

**Request:**
```json
{
  "execution_id": "bolna-id-123",
  "phone": "+919876543210",
  "status": "completed",
  "transcript": "...",
  "metadata": {}
}
```

**Response:**
```json
{
  "ok": true,
  "session_id": "uuid"
}
```

---

## ⚠️ Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "detail": "Detailed error information",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `UNAUTHORIZED`: Invalid or missing authentication
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request parameters
- `CONFLICT`: Resource conflict (e.g., double booking)
- `INTERNAL_ERROR`: Server-side error
- `SERVICE_UNAVAILABLE`: External service unavailable

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: External service unavailable

---

## 📝 Rate Limiting

Currently, no rate limiting is implemented. For production deployments, consider implementing:

- Rate limiting per IP address
- Rate limiting per API key
- Burst allowance for sensitive operations

---

## 🔒 CORS Configuration

The backend implements CORS to allow cross-origin requests from the frontend. Configure allowed origins via the `ALLOWED_ORIGINS` environment variable:

```bash
ALLOWED_ORIGINS=http://localhost:5173,https://your-dashboard.vercel.app
```

Use `*` to allow all origins (not recommended for production).

---

## 🧪 Testing APIs

### Using cURL

```bash
# Health check
curl http://localhost:8080/api/health

# Get appointments
curl http://localhost:8080/api/appointments

# Tool call with authentication
curl -X POST http://localhost:8080/tools/identify_caller \
  -H "X-Tool-Secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

### Using the Dashboard

The React dashboard provides a user-friendly interface for most API operations. Navigate to different sections to interact with the data:

- **Appointments**: View and manage appointments
- **Patients**: Search and view patient information
- **Calls**: Monitor call sessions and transcripts
- **Follow-ups**: Track and resolve escalations

---

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [REST API Best Practices](https://restfulapi.net/)
- [API Security Guidelines](https://owasp.org/www-project-api-security/)
