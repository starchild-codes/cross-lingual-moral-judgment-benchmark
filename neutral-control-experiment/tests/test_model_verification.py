from __future__ import annotations

import json

import pytest

from src.openrouter_client import OpenRouterResult
from src.run_experiment import verify_models


class SequencedClient:
    def __init__(self, outputs: list[str | None]):
        self.outputs = iter(outputs)

    def request(self, **kwargs) -> OpenRouterResult:
        output = next(self.outputs)
        return OpenRouterResult(
            raw_output=output,
            http_status=200,
            error_note=None if output is not None else "No output",
            prompt_tokens=10,
            completion_tokens=1,
            total_tokens=11,
            reported_cost=0.001,
            response_json=json.dumps(
                {"model": kwargs["model"], "choices": [], "usage": {"cost": 0.001}}
            ),
            temporary_error=False,
        )


def request_config(maximum_attempts: int = 3) -> dict[str, float | int]:
    return {
        "temperature": 0,
        "max_tokens": 5,
        "maximum_attempts": maximum_attempts,
        "backoff_seconds": 0,
        "delay_seconds": 0,
    }


def test_model_verification_retries_and_preserves_failed_attempt(
    tmp_path, monkeypatch
):
    output = tmp_path / "verification.json"
    monkeypatch.setattr("src.run_experiment.MODEL_VERIFICATION", output)
    client = SequencedClient([None, "1"])

    verify_models(
        client,
        {"gemini": {"model": "google/test-model"}},
        ["gemini"],
        request_config(),
    )

    records = json.loads(output.read_text(encoding="utf-8"))
    assert len(records) == 2
    assert records[0]["raw_output"] is None
    assert records[1]["raw_output"] == "1"
    assert [record["attempt_number"] for record in records] == [1, 2]


def test_model_verification_stops_after_retry_limit(tmp_path, monkeypatch):
    output = tmp_path / "verification.json"
    monkeypatch.setattr("src.run_experiment.MODEL_VERIFICATION", output)
    client = SequencedClient([None, None, None])

    with pytest.raises(RuntimeError, match="failed after 3 attempts"):
        verify_models(
            client,
            {"gemini": {"model": "google/test-model"}},
            ["gemini"],
            request_config(),
        )

    records = json.loads(output.read_text(encoding="utf-8"))
    assert len(records) == 3
