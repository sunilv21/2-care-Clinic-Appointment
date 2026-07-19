from fastapi.testclient import TestClient

from app import main as main_module


def test_call_end_webhook_accepts_alternative_payload_fields(monkeypatch):
    captured = {}

    def fake_finalize_call(*, phone, status, direction="inbound", transcript=None, bolna_execution_id=None):
        captured["phone"] = phone
        captured["status"] = status
        captured["direction"] = direction
        captured["transcript"] = transcript
        captured["bolna_execution_id"] = bolna_execution_id
        return {"ok": True, "session_id": 1, "state": "completed"}

    monkeypatch.setattr(main_module.tools, "finalize_call", fake_finalize_call)
    monkeypatch.setattr(main_module.config, "TOOL_WEBHOOK_SECRET", "test-secret")

    client = TestClient(main_module.app)
    response = client.post(
        "/webhooks/bolna_call_end",
        json={"phone_number": "+919999999999", "call_status": "completed", "direction": "inbound"},
        headers={"X-Tool-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert captured["phone"] == "+919999999999"
    assert captured["status"] == "completed"
    assert captured["direction"] == "inbound"


def test_finalize_call_uses_fallback_phone_when_missing(monkeypatch):
    class FakeCursor:
        def __init__(self):
            self.params = None

        def execute(self, query, params):
            self.params = params

        def fetchone(self):
            return (1,)

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            return FakeCursor()

    fake_cursor = FakeCursor()

    class FakeDB:
        def query_one(self, *args, **kwargs):
            return None

        def get_conn(self):
            return FakeConn()

    monkeypatch.setattr(main_module.tools, "db", FakeDB())

    result = main_module.tools.finalize_call(status="completed", direction="inbound", bolna_execution_id="abc123")

    assert result["ok"] is True
    assert result["session_id"] == 1
