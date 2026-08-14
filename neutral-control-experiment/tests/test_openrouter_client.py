from __future__ import annotations

from src.openrouter_client import OpenRouterClient


class FakeResponse:
    ok = True
    status_code = 200

    def json(self):
        return {
            "choices": [{"message": {"content": "1"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 1, "total_tokens": 11},
        }


class FakeSession:
    def __init__(self):
        self.last_payload = None

    def post(self, *args, **kwargs):
        assert kwargs["headers"]["Authorization"] == "Bearer secret"
        self.last_payload = kwargs["json"]
        return FakeResponse()


def test_mocked_request_never_uses_network():
    session = FakeSession()
    client = OpenRouterClient("secret", timeout_seconds=10, session=session)
    result = client.request("test/model", "system", "user", temperature=0, max_tokens=5)
    assert result.raw_output == "1"
    assert result.total_tokens == 11
    assert result.reported_cost is None
    assert "reasoning" not in session.last_payload


def test_reasoning_effort_uses_openrouter_request_format():
    session = FakeSession()
    client = OpenRouterClient("secret", timeout_seconds=10, session=session)
    client.request(
        "google/gemini-3.5-flash",
        "system",
        "user",
        temperature=0,
        max_tokens=16,
        reasoning_effort="minimal",
    )
    assert session.last_payload["max_tokens"] == 16
    assert session.last_payload["reasoning"] == {"effort": "minimal"}
