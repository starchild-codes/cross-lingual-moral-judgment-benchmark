from __future__ import annotations

from src.storage import ResultStore, response_id, unique_key


def record(key: str, valid: bool, rating: int | None, attempt: int) -> dict:
    return {
        "response_id": response_id(key),
        "unique_key": key,
        "control_id": "C01",
        "control_title": "Test",
        "model_key": "chatgpt",
        "openrouter_model_string": "test/model",
        "request_temperature": 0,
        "request_max_tokens": 16,
        "reasoning_effort": None,
        "condition_id": "en_en",
        "input_language": "en",
        "scenario_version": "baseline",
        "response_language": "en",
        "scenario_text": "Frozen text",
        "question_text": "Frozen question",
        "system_prompt": "System",
        "rating_instruction": "Instruction",
        "raw_output": str(rating) if rating is not None else "",
        "parsed_rating": rating,
        "is_valid": int(valid),
        "attempt_count": attempt,
        "http_status": 200,
        "error_note": None if valid else "invalid",
        "prompt_tokens": None,
        "completion_tokens": None,
        "total_tokens": None,
        "reported_cost": None,
        "retry_prompt_differed": int(attempt > 1),
    }


def test_valid_response_is_resumable_and_not_overwritten(tmp_path):
    store = ResultStore(tmp_path / "results.sqlite3")
    key = unique_key("C01", "chatgpt", "en_en")
    store.save_response(record(key, True, 1, 1))
    assert store.has_valid(key)
    store.save_response(record(key, False, None, 2))
    saved = store.get(key)
    assert saved["parsed_rating"] == 1
    assert saved["is_valid"] == 1
    assert len(store.rows()) == 1


def test_duplicate_unique_key_updates_single_work_unit(tmp_path):
    store = ResultStore(tmp_path / "results.sqlite3")
    key = unique_key("C01", "chatgpt", "en_en")
    store.save_response(record(key, False, None, 1))
    store.save_response(record(key, True, 2, 2))
    assert len(store.rows()) == 1
    assert store.get(key)["attempt_count"] == 2
    assert store.get(key)["parsed_rating"] == 2
