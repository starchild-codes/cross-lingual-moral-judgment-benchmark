from pathlib import Path

import pytest

from comprehension_check.runner import (
    execute_rows,
    review_gate,
    select_smoke_rows,
    validate_parameter_consistency,
)
from comprehension_check.storage import ResultStore


def manifest_row(model_key="chatgpt"):
    model_ids = {
        "chatgpt": "openai/gpt-4o-2024-11-20",
        "claude": "anthropic/claude-sonnet-4.6",
        "gemini_flash": "google/gemini-3.5-flash",
    }
    return {
        "work_unit_id": f"S01__hi__literal__{model_key}",
        "scenario_id": "S01",
        "model_key": model_key,
        "model_id": model_ids[model_key],
        "input_language": "hi",
        "scenario_version": "literal",
        "temperature": "0",
        "max_tokens": "24",
        "reasoning_effort": "minimal" if model_key == "gemini_flash" else "",
        "full_prompt": "Prompt",
        "answer_key": "A,B,C,D",
    }


def test_review_gate_blocks_pending_rows():
    passed, unresolved = review_gate(
        [
            {
                "question_id": "S01_Q1",
                "language_code": "hi",
                "scenario_version": "literal",
                "native_review_status": "Pending native-speaker review",
                "semantic_fidelity_1_5": "",
                "naturalness_1_5": "",
                "single_correct_answer": "",
            }
        ]
    )
    assert not passed
    assert len(unresolved) == 1


def test_review_gate_accepts_fully_reviewed_rows():
    passed, unresolved = review_gate(
        [
            {
                "question_id": "S01_Q1",
                "language_code": "hi",
                "scenario_version": "literal",
                "native_review_status": "Approved",
                "semantic_fidelity_1_5": "5",
                "naturalness_1_5": "5",
                "single_correct_answer": "Yes",
            }
        ]
    )
    assert passed and not unresolved


def test_smoke_selection_has_three_exact_models():
    rows = [manifest_row(key) for key in ("chatgpt", "claude", "gemini_flash")]
    selected = select_smoke_rows(rows)
    assert {row["model_id"] for row in selected} == {
        "openai/gpt-4o-2024-11-20",
        "anthropic/claude-sonnet-4.6",
        "google/gemini-3.5-flash",
    }


def test_manifest_parameters_are_consistent():
    rows = [manifest_row(key) for key in ("chatgpt", "claude", "gemini_flash")]
    validate_parameter_consistency(rows)


def test_manifest_parameter_inconsistency_fails():
    rows = [manifest_row(), manifest_row()]
    rows[1]["work_unit_id"] = "different"
    rows[1]["max_tokens"] = "99"
    with pytest.raises(RuntimeError):
        validate_parameter_consistency(rows)


def test_execute_rows_with_mocked_response(tmp_path):
    row = manifest_row()
    store = ResultStore(tmp_path / "active.sqlite")

    def fake_request(api_key, payload):
        assert api_key == "test"
        return {
            "choices": [{"message": {"content": "A,B,C,D"}}],
            "usage": {
                "prompt_tokens": 20,
                "completion_tokens": 4,
                "total_tokens": 24,
                "cost": 0.001,
            },
        }

    execute_rows([row], "test", store, request_fn=fake_request)
    assert store.completed_ids() == {row["work_unit_id"]}
    store.close()


def test_execute_rows_stops_after_retry_limit(tmp_path):
    row = manifest_row()
    store = ResultStore(tmp_path / "active.sqlite")

    def bad_request(api_key, payload):
        return {"choices": [{"message": {"content": "explanation"}}]}

    with pytest.raises(RuntimeError):
        execute_rows([row], "test", store, request_fn=bad_request, retry_limit=2)
    count = store.connection.execute("SELECT COUNT(*) FROM attempts").fetchone()[0]
    assert count == 2
    store.close()
