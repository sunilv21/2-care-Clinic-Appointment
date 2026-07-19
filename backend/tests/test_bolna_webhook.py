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
